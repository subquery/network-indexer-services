use axum::{
    extract::ws::{CloseFrame, Message, WebSocket},
    http::{HeaderMap, HeaderValue},
};
use base64::{engine::general_purpose, Engine as _};
use serde::{Deserialize, Serialize};
use serde_json::{from_str, json};
use std::result::Result;
use tokio::net::TcpStream;
use tokio_tungstenite::{MaybeTlsStream, WebSocketStream};

use futures_util::{sink::SinkExt, StreamExt};
use subql_indexer_utils::error::Error;
use tokio_tungstenite::tungstenite::protocol::Message as TMessage;

use crate::{cli::COMMAND, project::get_project, response::sign_response};

pub type SocketConnection = WebSocketStream<MaybeTlsStream<TcpStream>>;

#[derive(Serialize, Deserialize, Debug)]
struct ReceivedMessage {
    body: String,
    auth: String,
}

enum QueryStateType {
    Single,
    Multiple,
}

struct WebSocketConnection {
    client_socket: WebSocket,
    remote_socket: SocketConnection,
    query_state_type: QueryStateType,
    res_fmt: String,
}

impl WebSocketConnection {
    async fn new(
        mut headers: HeaderMap,
        mut client_socket: WebSocket,
        deployment: &str,
    ) -> Option<Self> {
        let res_fmt_value: HeaderValue = headers
            .remove("X-Indexer-Response-Format")
            .unwrap_or(HeaderValue::from_static("inline"));
        let res_fmt = res_fmt_value.to_str().unwrap().to_string();

        let query_state_type = headers
            .remove("X-Channel-Block")
            .map(|_| QueryStateType::Multiple)
            .unwrap_or(QueryStateType::Single);

        let remote_socket = match connect_to_project_ws(deployment).await {
            Ok(socket) => socket,
            Err(_) => {
                let _ = close_socket(&mut client_socket, Some(Error::WebSocket(3008))).await;
                return None;
            }
        };

        Some(WebSocketConnection {
            client_socket,
            remote_socket,
            res_fmt,
            query_state_type,
        })
    }

    async fn send_msg_to_client(&mut self, msg: Message) {
        self.client_socket
            .send(msg)
            .await
            .expect("Failed to send message to client");
    }

    async fn send_msg_to_remote(&mut self, msg: TMessage) {
        self.remote_socket
            .send(msg)
            .await
            .expect("Failed to send message to remote WebSocket");
    }

    async fn send_text_msg(&mut self, msg: String) -> Result<(), Error> {
        let response_msg = format_response(msg.into_bytes(), &self.res_fmt).await;
        self.client_socket
            .send(Message::Text(response_msg))
            .await
            .map_err(|_| Error::WebSocket(3006))?;
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

    async fn receive_text_msg(&mut self, raw_msg: &str) -> Result<(), Error> {
        let msg: ReceivedMessage = parse_message(raw_msg)?;
        self.remote_socket
            .send(TMessage::Text(msg.body))
            .await
            .map_err(|_| Error::WebSocket(3005))?;
        Ok(())
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
            .map_err(|_| Error::WebSocket(3015))?;
        Ok(())
    }

    async fn close_all(&mut self, error: Option<Error>) -> Result<(), Error> {
        self.close_remote().await?;
        self.close_client(error).await?;
        Ok(())
    }
}

pub async fn handle_query_websocket(
    client_socket: WebSocket,
    headers: HeaderMap,
    deployment: String,
) {
    println!("WebSocket connected for deployment: {}", deployment);
    let mut ws_connection =
        match WebSocketConnection::new(headers, client_socket, &deployment).await {
            Some(ws_connection) => ws_connection,
            None => return,
        };

    loop {
        let socket_message = ws_connection.client_socket.recv().await;
        if socket_message.is_none() {
            // the message is None when the client closes the connection
            let _ = ws_connection.close_remote().await;
            break;
        }

        match socket_message.unwrap() {
            Ok(msg) => {
                let _ = handle_client_socket_message(&mut ws_connection, msg).await;
            }
            Err(e) => {
                println!("WebSocket error: {}", e);
                let _ = ws_connection.close_all(Some(Error::WebSocket(3009))).await;
                break;
            }
        }

        if let Some(remote_response) = ws_connection.remote_socket.next().await {
            match remote_response {
                Ok(msg) => {
                    let _ = handle_remote_socket_message(&mut ws_connection, msg).await;
                }
                Err(_) => {
                    let _ = ws_connection.close_all(Some(Error::WebSocket(3010))).await;
                    break;
                }
            }
        }
    }

    println!("WebSocket closed for deployment: {}", deployment);
}

pub async fn handle_payg_websocket(
    client_socket: WebSocket,
    headers: HeaderMap,
    deployment: String,
) {
    println!("WebSocket connected for deployment: {}", deployment);
    let mut ws_connection =
        match WebSocketConnection::new(headers, client_socket, &deployment).await {
            Some(ws_connection) => ws_connection,
            None => return,
        };

    loop {
        let socket_message = ws_connection.client_socket.recv().await;
        if socket_message.is_none() {
            // the message is None when the client closes the connection
            let _ = ws_connection.close_remote().await;
            break;
        }

        match socket_message.unwrap() {
            Ok(msg) => {
                let _ = handle_client_socket_message(&mut ws_connection, msg).await;
            }
            Err(e) => {
                println!("WebSocket error: {}", e);
                let _ = ws_connection.close_all(Some(Error::WebSocket(3009))).await;
                break;
            }
        }

        if let Some(remote_response) = ws_connection.remote_socket.next().await {
            match remote_response {
                Ok(msg) => {
                    let _ = handle_remote_socket_message(&mut ws_connection, msg).await;
                }
                Err(_) => {
                    let _ = ws_connection.close_all(Some(Error::WebSocket(3010))).await;
                    break;
                }
            }
        }
    }

    println!("WebSocket closed for deployment: {}", deployment);
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
            // TODO: handle binary messages later
            println!("Forwarding binary message to remote");
            ws_connection
                .close_all(Some(Error::WebSocket(3011)))
                .await?
        }
        Message::Close(_) => {
            println!("Client closed the WebSocket");
            ws_connection.close_remote().await?
        }
        _ => {
            println!("Fowarding PING/PONG message to remote");
            // ws_connection.send_msg_to_remote(msg.into_tungstenite()).await;
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
            if ws_connection.send_text_msg(text).await.is_err() {
                ws_connection
                    .close_all(Some(Error::WebSocket(3011)))
                    .await?;
            }
        }
        TMessage::Binary(_) => {
            println!("Received binary response from remote, sending back to client");
            ws_connection
                .close_all(Some(Error::WebSocket(3011)))
                .await?;
        }
        TMessage::Close(_) => {
            println!("Remote closed the WebSocket");
            ws_connection
                .close_client(Some(Error::WebSocket(3012)))
                .await?;
        }
        _ => {
            println!("Forwarding PING/PONG message to client");
            // ws_connection.send_msg_to_client(msg).await;
        }
    }

    Ok(())
}

// Asynchronously connect to a remote WebSocket endpoint
pub async fn connect_to_project_ws(deployment_id: &str) -> Result<SocketConnection, Error> {
    // TODO: revert this commented code
    // let project = get_project(deployment_id).await.unwrap();
    // let ws_url = match project.ws_endpoint() {
    //     Some(ws_url) => ws_url,
    //     None => return Err(Error::WebSocket(3000)),
    // };

    let ws_url = "wss://ethereum-rpc.publicnode.com";

    let url = url::Url::parse(&ws_url).map_err(|_| Error::WebSocket(3001))?;
    let (socket, _) = tokio_tungstenite::connect_async(url)
        .await
        .map_err(|_| Error::WebSocket(3002))?;

    println!("Connected to the server: {}", ws_url);
    Ok(socket)
}

async fn close_socket(socket: &mut WebSocket, error: Option<Error>) -> Result<(), Error> {
    let (_, code, reason) = error.unwrap_or(Error::WebSocket(3000)).to_status_message();
    socket
        .send(Message::Close(Some(CloseFrame {
            code: code as u16,
            reason: reason.into(),
        })))
        .await
        .map_err(|_| Error::WebSocket(3007))?;
    Ok(())
}

fn parse_message(msg: &str) -> Result<ReceivedMessage, Error> {
    match from_str::<ReceivedMessage>(msg) {
        Ok(parsed_message) => {
            // Verify the auth
            if COMMAND.auth() && parsed_message.auth.is_empty() {
                return Err(Error::WebSocket(3004));
            }
            Ok(parsed_message)
        }
        Err(_) => Err(Error::WebSocket(3003)),
    }
}

async fn format_response(data: Vec<u8>, res_fmt: &str) -> String {
    // TODO: if pagy need to add the `state` field

    let signature = sign_response(&data).await;
    match res_fmt {
        // FIXME: don't think we need the inline format
        "inline" => String::from_utf8(data).unwrap_or("".to_owned()),
        _ => {
            let result = general_purpose::STANDARD.encode(&data);
            serde_json::to_string(&json!({ "result": result, "signature": signature}))
                .unwrap_or("".to_owned())
        }
    }
}

pub async fn validate_project(deployment: &str) -> Result<(), Error> {
    let project: crate::project::Project = get_project(&deployment).await?;
    if !project.is_rpc_project() {
        // only rpc project support websocket
        return Err(Error::WebSocket(3012));
    }
    if project.ws_endpoint().is_none() {
        // No ws endpoint found for this project
        return Err(Error::WebSocket(3000));
    }

    Ok(())
}
