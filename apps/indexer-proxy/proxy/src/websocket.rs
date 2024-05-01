use axum::extract::ws::{CloseCode, CloseFrame, Message, WebSocket};
use tokio_tungstenite::{WebSocketStream, MaybeTlsStream};
use tokio::net::TcpStream;
use std::result::Result;
use tokio::sync::Mutex;

use futures_util::{StreamExt, sink::SinkExt};
use tokio_tungstenite::tungstenite::protocol::Message as TMessage;
use subql_indexer_utils::error::Error;

use crate::project::get_project;

pub type SocketConnection = WebSocketStream<MaybeTlsStream<TcpStream>>;

pub struct WSConnections {
    pub sockets: Mutex<Vec<WebSocket>>,
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

fn create_close_msg(code: CloseCode, msg: String) -> Message {
    Message::Close(Some(CloseFrame {
        code: code.into(),
        reason: msg.into(),
    }))
}

pub async fn handle_websocket(
    mut client_socket: WebSocket,
    deployment: String,
) {
    println!("WebSocket connected for deployment: {}", deployment);

    // TODO: handle the socket on close and on error events
    let mut remote_socket = match connect_to_project_ws(&deployment).await {
        Ok(socket) => socket,
        Err(e) => {
            let msg = format!("Failed to connect to remote WebSocket: {:?}", e);
            client_socket.send( Message::Close(Some(CloseFrame {
                code: 500,
                reason: msg.into(),
            }))).await.expect("Failed to send close message to client");
            return;
        }
    };

    // Process messages from client and forward them to the remote socket
    while let Some(result) = client_socket.recv().await {
        match result {
            Ok(msg) => {
                // Handle incoming messages as before
                match msg {
                    Message::Text(text) => {
                        println!("Forwarding text message to Ethereum: {}", text);
                        // TODO: handle the limitation or metrics etc
                        remote_socket.send(TMessage::Text(text)).await.expect("Failed to send text message to Ethereum endpoint");
                    },
                    Message::Binary(data) => {
                        println!("Forwarding binary message to Ethereum");
                        remote_socket.send(TMessage::Binary(data)).await.expect("Failed to send binary message to Ethereum endpoint");
                    },
                    Message::Close(_) => {
                        println!("Client closed the WebSocket");
                        remote_socket.close(None).await.expect("Failed to close remote WebSocket");
                        break;
                    },
                    Message::Ping(data) => {
                        println!("Received ping from client, sending pong");
                        remote_socket.send(TMessage::Ping(data)).await.expect("Failed to send ping to remote");
                    },
                    Message::Pong(data) => {
                        println!("Received pong from client");
                        remote_socket.send(TMessage::Pong(data)).await.expect("Failed to send pong to remote");
                    },
                }
            },
            Err(e) => {
                println!("WebSocket error: {}", e);
                remote_socket.close(None).await.expect("Failed to close remote WebSocket");
                break;  // Exit the loop on error
            }
        }

        // Optionally, wait for a response from Ethereum and send it back to the client
        if let Some(remote_response) = remote_socket.next().await {
            match remote_response {
                Ok(msg) => match msg {
                    TMessage::Text(text) => {
                        println!("Received text response from Ethereum, sending back to client: {}", text);
                        client_socket.send(Message::Text(text)).await.expect("Failed to send response to client");
                    },
                    TMessage::Binary(data) => {
                        println!("Received binary response from Ethereum, sending back to client");
                        client_socket.send(Message::Binary(data)).await.expect("Failed to send response to client");
                    },
                    TMessage::Close(_) => {
                        println!("Remote closed the WebSocket");
                        client_socket.send(create_close_msg(1000, "Remote closed the WebSocket".to_string())).await.expect("Failed to send close message to client");
                        break;
                    },
                    TMessage::Ping(data) => {
                        println!("Received ping from Ethereum, sending pong");
                        client_socket.send(Message::Ping(data)).await.expect("Failed to send ping to client");
                    },
                    TMessage::Pong(data) => {
                        println!("Received pong from Ethereum");
                        client_socket.send(Message::Pong(data)).await.expect("Failed to send pong to client");
                    },
                },
                Err(e) => {
                    println!("Error receiving response from remote: {}", e);
                    client_socket.send(Message::Close(None)).await.expect("Failed to close client WebSocket");
                    break;  // Exit the loop on error
                },
            }
        }
    }

    // TODO: how can safely remove the remote connection when the client disconnects?
    println!("WebSocket closed for deployment: {}", deployment);
}