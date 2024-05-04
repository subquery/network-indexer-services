use axum::{
    extract::ws::{CloseCode, CloseFrame, Message, WebSocket},
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

// Asynchronously connect to a remote WebSocket endpoint
pub async fn connect_to_project_ws(deployment_id: &str) -> Result<SocketConnection, Error> {
    // TODO: revert this commented code
    // let project = get_project(deployment_id).await.unwrap();
    // let ws_url = match project.ws_endpoint() {
    //     Some(ws_url) => ws_url,
    //     None => return Err(Error::WebSocket(3000)),
    // };

    let ws_url = "wss://ethereum-rpc.publicnode.com";

    let url = match url::Url::parse(&ws_url) {
        Ok(url) => url,
        Err(_) => return Err(Error::WebSocket(3001)),
    };

    let socket = match tokio_tungstenite::connect_async(url).await {
        Ok((socket, _)) => socket,
        Err(_) => return Err(Error::WebSocket(3002)),
    };

    println!("Connected to the server: {}", ws_url);
    Ok(socket)
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

struct WebSocketConnection {
    client_socket: WebSocket,
    remote_socket: SocketConnection,
    res_fmt: String,
}

impl WebSocketConnection {
    async fn send_text_msg(&mut self, msg: String) {
        let response_msg = format_response(msg.into_bytes(), &self.res_fmt).await;
        self.client_socket
            .send(Message::Text(response_msg))
            .await
            .expect("Failed to send response to client");
    }

    async fn receive_text_msg(&mut self, raw_msg: &str) {
        let msg = parse_message(raw_msg).expect("Failed to parse message");
        self.remote_socket
            .send(TMessage::Text(msg.body))
            .await
            .expect("Failed to send text message to Ethereum endpoint");
    }

    async fn close(&mut self, code: Option<CloseCode>, reason: Option<String>) {
        self.client_socket
            .send(Message::Close(Some(CloseFrame {
                code: code.unwrap_or(500),
                reason: reason.unwrap_or("Internal Server Error".to_string()).into(),
            })))
            .await
            .expect("Failed to send close message to client");
        self.remote_socket
            .close(None)
            .await
            .expect("Failed to close remote WebSocket");
    }
}

pub async fn handle_websocket(
    mut client_socket: WebSocket,
    mut headers: HeaderMap,
    deployment: String,
) {
    // TODO: handle the socket on close and on error events
    println!("WebSocket connected for deployment: {}", deployment);

    let res_fmt_value: HeaderValue = headers
        .remove("X-Indexer-Response-Format")
        .unwrap_or(HeaderValue::from_static("inline"));
    let res_fmt = res_fmt_value.to_str().unwrap().to_string();

    let remote_socket = match connect_to_project_ws(&deployment).await {
        Ok(socket) => socket,
        Err(e) => {
            let msg = format!("Failed to connect to remote WebSocket: {:?}", e);
            client_socket
                .send(Message::Close(Some(CloseFrame {
                    code: 500,
                    reason: msg.into(),
                })))
                .await
                .expect("Failed to send close message to client");
            return;
        }
    };

    let mut ws_connection = WebSocketConnection {
        client_socket,
        remote_socket,
        res_fmt,
    };

    // Process messages from client and forward them to the remote socket
    while let Some(result) = ws_connection.client_socket.recv().await {
        match result {
            Ok(msg) => {
                // Handle incoming messages as before
                match msg {
                    Message::Text(text) => {
                        println!("Forwarding text message to remote: {}", text);
                        ws_connection.receive_text_msg(&text).await;
                    }
                    Message::Binary(_) => {
                        // TODO: ingore the bianary data for now
                        println!("Client closed the WebSocket");
                        ws_connection.close(None, None).await;
                        break;
                    }
                    Message::Close(_) => {
                        println!("Client closed the WebSocket");
                        ws_connection.close(None, None).await;
                        break;
                    }
                    Message::Ping(data) => {
                        println!("Received ping from client, sending pong");
                        ws_connection
                            .remote_socket
                            .send(TMessage::Ping(data))
                            .await
                            .expect("Failed to send ping to remote");
                    }
                    Message::Pong(data) => {
                        println!("Received pong from client");
                        ws_connection
                            .remote_socket
                            .send(TMessage::Pong(data))
                            .await
                            .expect("Failed to send pong to remote");
                    }
                }
            }
            Err(e) => {
                println!("WebSocket error: {}", e);
                ws_connection
                    .remote_socket
                    .close(None)
                    .await
                    .expect("Failed to close remote WebSocket");
                break; // Exit the loop on error
            }
        }

        // Optionally, wait for a response from Ethereum and send it back to the client
        if let Some(remote_response) = ws_connection.remote_socket.next().await {
            match remote_response {
                Ok(msg) => match msg {
                    TMessage::Text(text) => {
                        println!(
                            "Received text response from remote, sending back to client: {}",
                            text
                        );
                        ws_connection.send_text_msg(text).await;
                    }
                    TMessage::Binary(_) => {
                        println!("Received binary response from remote, sending back to client");
                        ws_connection.close(None, None).await;
                        break;
                    }
                    TMessage::Close(_) => {
                        println!("Remote closed the WebSocket");
                        ws_connection.close(None, None).await;
                        break;
                    }
                    TMessage::Ping(data) => {
                        println!("Received ping from remote, sending pong");
                        ws_connection
                            .client_socket
                            .send(Message::Ping(data))
                            .await
                            .expect("Failed to send ping to client");
                    }
                    TMessage::Pong(data) => {
                        println!("Received pong from remote");
                        ws_connection
                            .client_socket
                            .send(Message::Pong(data))
                            .await
                            .expect("Failed to send pong to client");
                    }
                },
                Err(e) => {
                    println!("Error receiving response from remote: {}", e);
                    ws_connection.close(None, None).await;
                    break; // Exit the loop on error
                }
            }
        }
    }

    // TODO: how can safely remove the remote connection when the client disconnects?
    println!("WebSocket closed for deployment: {}", deployment);
}
