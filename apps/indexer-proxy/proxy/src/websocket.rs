use axum::extract::ws::{Message, WebSocket};
use tokio_tungstenite::{WebSocketStream, MaybeTlsStream};
use tokio::net::TcpStream;
use std::result::Result;

use futures_util::{StreamExt, sink::SinkExt};
use tokio_tungstenite::tungstenite::protocol::Message as TMessage;
use subql_indexer_utils::error::Error;

use crate::project::get_project;

pub type SocketConnection = WebSocketStream<MaybeTlsStream<TcpStream>>;

// Asynchronously connect to a remote WebSocket endpoint
pub async fn connect_to_project_ws(deployment_id: &str) -> Result<SocketConnection, Error> {
    let project = get_project(deployment_id).await.unwrap();
    let ws_url = match project.ws_endpoint() {
        Some(ws_url) => ws_url,
        None => return Err(Error::WebSocket(3000)),
    };

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

pub async fn handle_websocket(
    mut client_socket: WebSocket,
    deployment: String,
) {
    println!("WebSocket connected for deployment: {}", deployment);

    // TODO: handle the socket on close and on error events
    let mut remote_socket = connect_to_project_ws(&deployment).await.expect("Failed to connect to remote endpoint");

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
                    _ => {
                        println!("Unsupported message type");
                        remote_socket.close(None).await.expect("Failed to close remote WebSocket");
                        break;
                    }
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
                Ok(TMessage::Text(response_text)) => {
                    println!("Received text response from remote, sending back to client: {}", response_text);
                    client_socket.send(Message::Text(response_text)).await.expect("Failed to send response to client");
                },
                Ok(TMessage::Binary(response_data)) => {
                    println!("Received binary response from remote, sending back to client");
                    client_socket.send(Message::Binary(response_data)).await.expect("Failed to send response to client");
                },
                Err(e) => {
                    println!("Error receiving response from remote: {}", e);
                    client_socket.send(Message::Close(None)).await.expect("Failed to close client WebSocket");
                    break;  // Exit the loop on error
                },
                _ => {
                    println!("Unsupported message type from remote");
                    client_socket.send(Message::Close(None)).await.expect("Failed to close client WebSocket");
                    break;  // Exit the loop on error
                }
            }
        }
    }

    // TODO: how can safely remove the remote connection when the client disconnects?
    println!("WebSocket closed for deployment: {}", deployment);
}