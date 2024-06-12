use axum::extract::ws::{CloseFrame, Message, WebSocket};
use base64::{engine::general_purpose, Engine as _};
use ethers::types::U256;
use serde::{Deserialize, Serialize};
use serde_json::{from_str, json};
use std::result::Result;
use tokio::{net::TcpStream, select};
use tokio_tungstenite::{MaybeTlsStream, WebSocketStream};

use futures_util::{sink::SinkExt, StreamExt};
use subql_indexer_utils::{error::Error, payg::MultipleQueryState};
use tokio_tungstenite::tungstenite::protocol::Message as TMessage;

use crate::{
    account::ACCOUNT,
    auth::{verify_auth_ws, AuthWhitelistQuery},
    cli::{redis, COMMAND},
    payg::{
        before_query_multiple_state, channel_id_to_keyname, check_multiple_state_balance,
        fetch_channel_cache, post_query_multiple_state, StateCache,
    },
    project::{get_project, Project},
    response::sign_response,
};

pub type SocketConnection = WebSocketStream<MaybeTlsStream<TcpStream>>;

#[derive(Serialize, Deserialize, Debug)]
struct ReceivedMessage {
    body: String,
    auth: String,
}

#[derive(Serialize, Deserialize, Debug)]
struct CacheState {
    state_remote: String,
    state_cache: Vec<u8>,
}

#[derive(Eq, PartialEq, Clone, Copy)]
pub enum QueryType {
    /// close agreement query with auth token
    CloseAgreement,
    /// multiple query start, end
    PAYG(U256, U256),
    /// whitelist query with signed payload
    Whitelist,
}

struct WebSocketConnection {
    deployment: String,
    client_socket: WebSocket,
    remote_socket: SocketConnection,
    order_id: U256,
    query_type: QueryType,
    no_sig: bool,
}

impl WebSocketConnection {
    fn new(
        remote_socket: SocketConnection,
        client_socket: WebSocket,
        query_type: QueryType,
        deployment: &str,
        no_sig: bool,
    ) -> Self {
        WebSocketConnection {
            deployment: deployment.to_string(),
            client_socket,
            remote_socket,
            query_type,
            no_sig,
            order_id: U256::zero(),
        }
    }

    async fn receive_text_msg(&mut self, raw_msg: &str) -> Result<(), Error> {
        let message = from_str::<ReceivedMessage>(raw_msg).map_err(|_| Error::WebSocket(1301))?;
        let ReceivedMessage { body, auth } = message;
        let inactive = self.before_query_check(auth, &body).await?;
        if let Some(state) = inactive {
            self.send_msg(vec![], "".to_owned(), state).await?;
            return Ok(());
        }

        self.remote_socket
            .send(TMessage::Text(body))
            .await
            .map_err(|_| Error::WebSocket(1302))?;
        Ok(())
    }

    async fn send_text_msg(&mut self, msg: String) -> Result<(), Error> {
        let state = self.post_query_sync().await?;
        let msg_data = msg.into_bytes();

        let signature = if self.no_sig {
            String::default()
        } else {
            sign_response(&msg_data).await
        };

        self.send_msg(msg_data, signature, state).await?;

        Ok(())
    }

    async fn send_msg(
        &mut self,
        msg: Vec<u8>,
        signature: String,
        state: String,
    ) -> Result<(), Error> {
        let result = general_purpose::STANDARD.encode(&msg);
        let response_msg = serde_json::to_string(
            &json!({ "result": result, "signature": signature, "state": state }),
        )
        .unwrap_or("".to_owned());

        self.client_socket
            .send(Message::Text(response_msg))
            .await
            .map_err(|_| Error::WebSocket(1303))?;

        Ok(())
    }

    async fn send_error_msg(&mut self, code: i32, reason: String) {
        let error_msg = json!({ "error": { "code": code, "message": reason } });
        if self
            .client_socket
            .send(Message::Text(error_msg.to_string()))
            .await
            .is_err()
        {
            let _ = self.close_all(None).await;
        }
    }

    async fn close_client(&mut self, error: Option<Error>) -> Result<(), Error> {
        debug!("CLOSE CLIENT");
        close_socket(&mut self.client_socket, error).await?;
        Ok(())
    }

    async fn close_remote(&mut self) -> Result<(), Error> {
        debug!("CLOSE REMOTE");
        self.remote_socket
            .close(None)
            .await
            .map_err(|_| Error::WebSocket(1304))?;
        Ok(())
    }

    async fn close_all(&mut self, error: Option<Error>) -> Result<(), Error> {
        debug!("CLOSE ALL");
        self.close_remote().await?;
        self.close_client(error).await?;
        Ok(())
    }

    async fn before_query_check(
        &mut self,
        auth: String,
        query: &str,
    ) -> Result<Option<String>, Error> {
        let project: Project = get_project(&self.deployment).await?;
        let (unit_times, unit_overflow) = project.compute_query_method(query)?;

        let (inactive, channel_id) = match &mut self.query_type {
            QueryType::CloseAgreement => {
                if COMMAND.auth() {
                    let deployment_id = verify_auth_ws(&auth).await?;
                    if deployment_id != self.deployment {
                        return Err(Error::AuthVerify(1004));
                    }
                }

                return Ok(None);
            }
            QueryType::PAYG(ref mut start, ref mut end) => {
                let (inactive, channel_id, new_start, new_end) =
                    Self::before_query_payg_check(auth, project, unit_times, unit_overflow).await?;

                if inactive.is_none() {
                    *start = new_start;
                    *end = new_end;
                }

                (inactive, channel_id)
            }
            QueryType::Whitelist => {
                if COMMAND.auth() {
                    let deployment_id = AuthWhitelistQuery::verify_auth(&auth).await?;
                    if deployment_id != self.deployment {
                        return Err(Error::AuthVerify(1004));
                    }
                }

                return Ok(None);
            }
        };

        self.order_id = channel_id;
        Ok(inactive)
    }

    async fn before_query_payg_check(
        auth: String,
        _project: Project,
        unit_times: u64,
        _unit_overflow: u64,
    ) -> Result<(Option<String>, U256, U256, U256), Error> {
        let raw_state = MultipleQueryState::from_bs64(auth)?;
        let start = raw_state.start;
        let end = raw_state.end;

        let channel_id = raw_state.channel_id;
        let (state, keyname, state_cache, inactive) =
            before_query_multiple_state(raw_state, unit_times).await?;

        if inactive {
            return Ok((Some(state.to_bs64()), channel_id, start, end));
        }

        let value = serde_json::to_string(&json!({
            "state_remote": state.to_bs64(),
            "state_cache": state_cache.to_bytes(),
        }))
        .map_err(|_| Error::WebSocket(1305))?;

        let cache_key = format!("{}-ws", keyname);

        let mut conn = redis();
        redis::cmd("SETEX")
            .arg(&cache_key)
            .arg(600) // 10min
            .arg(value)
            .query_async(&mut conn)
            .await
            .map_err(|_| Error::WebSocket(1305))?;

        Ok((None, channel_id, start, end))
    }

    /// FIXME: when request with unit compute send to proxy,
    /// proxy will store the tmp state cache, and when has response
    /// will use it, if not fetch the tmp state cache,
    /// will default use unit times = 1
    async fn fetch_state(keyname: &str) -> Result<(String, StateCache), Error> {
        let cache_key = format!("{}-ws", keyname);

        let mut conn = redis();
        let value: String = redis::cmd("GET")
            .arg(&cache_key)
            .query_async(&mut conn)
            .await
            .map_err(|_| Error::WebSocket(1306))?;
        let _ = redis::cmd("DEL")
            .arg(&cache_key)
            .query_async(&mut conn)
            .await
            .map_err(|_| Error::WebSocket(1306))?;

        let cache_states = from_str::<CacheState>(&value).map_err(|_| Error::WebSocket(1306))?;
        let state_str = cache_states.state_remote;
        let state_cache = StateCache::from_bytes(&cache_states.state_cache)
            .map_err(|_| Error::WebSocket(1306))?;

        Ok((state_str, state_cache))
    }

    async fn post_query_sync(&mut self) -> Result<String, Error> {
        match self.query_type {
            QueryType::CloseAgreement => Ok("".to_owned()),
            QueryType::Whitelist => Ok("".to_owned()),
            QueryType::PAYG(start, end) => {
                let keyname = channel_id_to_keyname(self.order_id);

                let (state_str, state_cache) = if let Ok((state_str, state_cache)) =
                    Self::fetch_state(&keyname).await
                {
                    (state_str, state_cache)
                } else {
                    let unit_times = 1;

                    // fetch state cache
                    let (mut state_cache, _) = fetch_channel_cache(self.order_id).await?;

                    // check spent & balance
                    let mpqsa = check_multiple_state_balance(&state_cache, unit_times, start, end)?;

                    // generate state
                    let account = ACCOUNT.read().await;
                    let state = MultipleQueryState::indexer_generate(
                        mpqsa,
                        self.order_id,
                        start,
                        end,
                        &account.controller,
                    )
                    .await?;
                    drop(account);

                    // update state cache. default unit is 1
                    state_cache.spent = state_cache.spent + state_cache.price * unit_times;

                    (state.to_bs64(), state_cache)
                };

                post_query_multiple_state(keyname, state_cache).await;
                Ok(state_str)
            }
        }
    }
}

enum SocketMessage {
    Client(Message),
    Remote(TMessage),
}

pub async fn handle_websocket(
    remote_socket: SocketConnection,
    client_socket: WebSocket,
    deployment: String,
    query_type: QueryType,
    no_sig: bool,
) {
    debug!("WebSocket connected for deployment: {}", deployment);
    let mut ws_connection = WebSocketConnection::new(
        remote_socket,
        client_socket,
        query_type,
        &deployment,
        no_sig,
    );

    loop {
        let res = select! {
            v = async { ws_connection.client_socket.recv().await.and_then(|v| v.ok()).map(SocketMessage::Client) } => v,
            v = async { ws_connection.remote_socket.next().await.and_then(|v| v.ok()).map(SocketMessage::Remote) } => v,
        };

        match res {
            Some(SocketMessage::Client(msg)) => {
                let _ = handle_client_socket_message(&mut ws_connection, msg).await;
            }
            Some(SocketMessage::Remote(msg)) => {
                let _ = handle_remote_socket_message(&mut ws_connection, msg).await;
            }
            None => break,
        }
    }

    debug!("WebSocket closed for deployment: {}", deployment);
}

async fn handle_client_socket_message(
    ws_connection: &mut WebSocketConnection,
    msg: Message,
) -> Result<(), Error> {
    match msg {
        Message::Text(text) => {
            debug!("Received text message from client");
            if let Err(e) = ws_connection.receive_text_msg(&text).await {
                let (_, code, reason) = e.to_status_message();
                ws_connection.send_error_msg(code, reason.to_string()).await;
            }
        }
        Message::Binary(_) => {
            debug!("Receive binary message to remote");
            ws_connection
                .close_all(Some(Error::WebSocket(1310)))
                .await?
        }
        Message::Close(_) => {
            debug!("Client closed the WebSocket");
            ws_connection.close_remote().await?
        }
        Message::Ping(data) => {
            debug!("Received PING message from client");
            ws_connection
                .remote_socket
                .send(TMessage::Ping(data))
                .await
                .map_err(|_| Error::WebSocket(1314))?;
        }
        Message::Pong(data) => {
            debug!("Received PONG message from client");
            ws_connection
                .remote_socket
                .send(TMessage::Pong(data))
                .await
                .map_err(|_| Error::WebSocket(1314))?;
        }
    }

    Ok(())
}

async fn handle_remote_socket_message(
    ws_connection: &mut WebSocketConnection,
    msg: TMessage,
) -> Result<(), Error> {
    match msg {
        TMessage::Text(text) => {
            debug!("Received text response from remote");
            if let Err(e) = ws_connection.send_text_msg(text).await {
                debug!("send message to client error: {:?}", e);
                ws_connection.close_all(Some(e)).await?;
            }
        }
        TMessage::Binary(_) | TMessage::Frame(_) => {
            debug!("Receive binary message to remote");
            ws_connection
                .close_all(Some(Error::WebSocket(1310)))
                .await?
        }
        TMessage::Ping(data) => {
            debug!("Received PING message from remote");
            ws_connection
                .client_socket
                .send(Message::Ping(data))
                .await
                .map_err(|_| Error::WebSocket(1313))?;
        }
        TMessage::Pong(data) => {
            debug!("Received PONG message from remote");
            ws_connection
                .client_socket
                .send(Message::Pong(data))
                .await
                .map_err(|_| Error::WebSocket(1313))?;
        }
        TMessage::Close(_) => {
            debug!("Remote closed the WebSocket");
            ws_connection
                .close_client(Some(Error::WebSocket(1308)))
                .await?;
        }
    }

    Ok(())
}

// Asynchronously connect to a remote WebSocket endpoint
pub async fn connect_to_project_ws(endpoint: String) -> Result<SocketConnection, Error> {
    debug!("Connecting to the server: {}", endpoint);
    let (socket, _) = tokio_tungstenite::connect_async(endpoint)
        .await
        .map_err(|_| Error::WebSocket(1308))?;

    Ok(socket)
}

async fn close_socket(socket: &mut WebSocket, error: Option<Error>) -> Result<(), Error> {
    let (_, code, reason) = error.unwrap_or(Error::WebSocket(1312)).to_status_message();
    socket
        .send(Message::Close(Some(CloseFrame {
            code: code as u16,
            reason: reason.into(),
        })))
        .await
        .map_err(|_| Error::WebSocket(1311))?;
    Ok(())
}

pub async fn validate_project(deployment: &str, ep_name: &str) -> Result<String, Error> {
    let project: crate::project::Project = get_project(&deployment).await?;
    if !project.is_rpc_project() {
        // only rpc project support websocket
        return Err(Error::WebSocket(1300));
    }

    let endpoint = project.endpoint(ep_name, true)?;
    if !endpoint.is_ws {
        Err(Error::WebSocket(1300))
    } else {
        Ok(endpoint.endpoint.clone())
    }
}
