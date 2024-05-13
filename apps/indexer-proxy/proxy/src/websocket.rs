use axum::extract::ws::{CloseFrame, Message, WebSocket};
use base64::{engine::general_purpose, Engine as _};
use ethers::types::U256;
use redis::RedisResult;
use serde::{Deserialize, Serialize};
use serde_json::{from_str, json};
use std::result::Result;
use tokio::{net::TcpStream, select};
use tokio_tungstenite::{MaybeTlsStream, WebSocketStream};

use futures_util::{sink::SinkExt, StreamExt};
use subql_indexer_utils::{error::Error, payg::MultipleQueryState};
use tokio_tungstenite::tungstenite::protocol::Message as TMessage;

use crate::{
    auth::verify_auth_ws,
    cli::{redis, COMMAND},
    payg::{
        before_query_multiple_state, channel_id_to_keyname, post_query_multiple_state, StateCache,
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
    CloseAgreement,
    PAYG,
}

struct WebSocketConnection {
    deployment: String,
    client_socket: WebSocket,
    remote_socket: SocketConnection,
    order_id: U256,
    query_type: QueryType,
}

impl WebSocketConnection {
    async fn new(
        mut client_socket: WebSocket,
        query_type: QueryType,
        deployment: &str,
    ) -> Option<Self> {
        let remote_socket = match connect_to_project_ws(deployment).await {
            Ok(socket) => socket,
            Err(_) => {
                let _ = close_socket(&mut client_socket, Some(Error::WebSocket(1308))).await;
                return None;
            }
        };

        Some(WebSocketConnection {
            deployment: deployment.to_string(),
            client_socket,
            remote_socket,
            query_type,
            order_id: U256::zero(),
        })
    }

    async fn receive_text_msg(&mut self, raw_msg: &str) -> Result<(), Error> {
        let message = from_str::<ReceivedMessage>(raw_msg).map_err(|_| Error::WebSocket(1301))?;
        let ReceivedMessage { body, auth } = message;
        let (status, state) = self.before_query_check(auth, &body).await?;
        if !status && state.is_some() {
            self.send_msg(vec![], "".to_owned(), state.unwrap()).await?;
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
        let signature = sign_response(&msg_data).await;

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

    async fn send_error_smg(&mut self, code: i32, reason: String) {
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
        close_socket(&mut self.client_socket, error).await?;
        Ok(())
    }

    async fn close_remote(&mut self) -> Result<(), Error> {
        println!("Closing remote WebSocket");
        self.remote_socket
            .close(None)
            .await
            .map_err(|_| Error::WebSocket(1304))?;
        Ok(())
    }

    async fn close_all(&mut self, error: Option<Error>) -> Result<(), Error> {
        self.close_remote().await?;
        self.close_client(error).await?;
        Ok(())
    }

    async fn before_query_check(
        &mut self,
        auth: String,
        query: &str,
    ) -> Result<(bool, Option<String>), Error> {
        let project: Project = get_project(&self.deployment).await?;
        let (unit_times, unit_overflow) = project.compute_query_method(query)?;

        match self.query_type {
            QueryType::CloseAgreement => {
                if COMMAND.auth() {
                    let deployment_id = verify_auth_ws(&auth).await?;
                    if deployment_id != self.deployment {
                        return Err(Error::AuthVerify(1004));
                    }
                }

                Ok((true, None))
            }
            QueryType::PAYG => {
                let (status, state) = self
                    .before_query_payg_check(auth, project, unit_times, unit_overflow)
                    .await?;
                Ok((status, state))
            }
        }
    }

    async fn before_query_payg_check(
        &mut self,
        auth: String,
        _project: Project,
        unit_times: u64,
        _unit_overflow: u64,
    ) -> Result<(bool, Option<String>), Error> {
        let raw_state = MultipleQueryState::from_bs64(auth)?;
        self.order_id = raw_state.channel_id;
        let (state, keyname, state_cache, inactive) =
            before_query_multiple_state(raw_state, unit_times).await?;

        if inactive {
            return Ok((false, Some(state.to_bs64())));
        }

        let value = serde_json::to_string(&json!({
            "state_remote": state.to_bs64(),
            "state_cache": state_cache.to_bytes(),
        }))
        .map_err(|_| Error::WebSocket(1305))?;

        let cache_key = format!("{}-ws", keyname);
        let mut conn = redis();
        let exp: RedisResult<usize> = redis::cmd("TTL").arg(&keyname).query_async(&mut conn).await;
        redis::cmd("SETEX")
            .arg(&cache_key)
            .arg(exp.unwrap_or(30000))
            .arg(value)
            .query_async(&mut conn)
            .await
            .map_err(|_| Error::WebSocket(1305))?;

        Ok((true, None))
    }

    async fn post_query_sync(&mut self) -> Result<String, Error> {
        if self.query_type != QueryType::PAYG {
            return Ok("".to_owned());
        }

        let keyname = channel_id_to_keyname(self.order_id);
        let cache_key = format!("{}-ws", keyname);

        let mut conn = redis();
        let value: String = redis::cmd("GET")
            .arg(&cache_key)
            .query_async(&mut conn)
            .await
            .map_err(|_| Error::WebSocket(1306))?;

        let cache_states = from_str::<CacheState>(&value).map_err(|_| Error::WebSocket(1306))?;
        let state_str = cache_states.state_remote;
        let state_cache = StateCache::from_bytes(&cache_states.state_cache)
            .map_err(|_| Error::WebSocket(1306))?;

        post_query_multiple_state(keyname, state_cache).await;
        Ok(state_str)
    }
}

enum SocketMessage {
    Client(Message),
    Remote(TMessage),
}

pub async fn handle_websocket(client_socket: WebSocket, deployment: String, query_type: QueryType) {
    debug!("WebSocket connected for deployment: {}", deployment);

    let mut ws_connection =
        match WebSocketConnection::new(client_socket, query_type, &deployment).await {
            Some(ws_connection) => ws_connection,
            None => return,
        };

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
            println!("Forwarding text message to remote: {}", text);
            if let Err(e) = ws_connection.receive_text_msg(&text).await {
                let (_, code, reason) = e.to_status_message();
                ws_connection.send_error_smg(code, reason.to_string()).await;
            }
        }
        Message::Binary(_) => {
            println!("Receive binary message to remote");
            ws_connection
                .close_all(Some(Error::WebSocket(1310)))
                .await?
        }
        Message::Close(_) => {
            println!("Client closed the WebSocket");
            ws_connection.close_remote().await?
        }
        _ => {
            println!("Fowarding PING/PONG message to remote");
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
            println!("Received text response from remote");
            if let Err(e) = ws_connection.send_text_msg(text).await {
                ws_connection.close_all(Some(e)).await?;
            }
        }
        TMessage::Binary(_) => {
            println!("Receive binary message to remote");
            ws_connection
                .close_all(Some(Error::WebSocket(1310)))
                .await?
        }
        TMessage::Close(_) => {
            println!("Remote closed the WebSocket");
            ws_connection
                .close_client(Some(Error::WebSocket(1308)))
                .await?;
        }
        _ => {
            println!("Forwarding PING/PONG message to client");
        }
    }

    Ok(())
}

// Asynchronously connect to a remote WebSocket endpoint
pub async fn connect_to_project_ws(_deployment_id: &str) -> Result<SocketConnection, Error> {
    // TODO: uncomment this when we have the project endpoint
    // let project = get_project(deployment_id).await.unwrap();
    // let ws_url = match project.ws_endpoint() {
    //     Some(ws_url) => ws_url,
    //     None => return Err(Error::WebSocket(1300)),
    // };

    // Test url
    let ws_url: &str = "wss://ethereum-rpc.publicnode.com";

    let url = url::Url::parse(ws_url).map_err(|_| Error::WebSocket(1308))?;
    let (socket, _) = tokio_tungstenite::connect_async(url)
        .await
        .map_err(|_| Error::WebSocket(1308))?;

    println!("Connected to the server: {}", ws_url);
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

pub async fn validate_project(deployment: &str) -> Result<(), Error> {
    let project: crate::project::Project = get_project(&deployment).await?;
    if !project.is_rpc_project() {
        // only rpc project support websocket
        return Err(Error::WebSocket(1300));
    }
    if project.ws_endpoint().is_none() {
        // No ws endpoint found for this project
        return Err(Error::WebSocket(1300));
    }

    Ok(())
}
