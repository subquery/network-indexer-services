use futures_util::{Stream, StreamExt};
use reqwest_streams::*;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use subql_indexer_utils::{error::Error, types::Result};
use tokenizers::tokenizer::Tokenizer;
use tokio::sync::mpsc::{channel, Sender};
use tokio_stream::wrappers::ReceiverStream;

const SCALE: usize = 10;

#[derive(Debug, Clone, Deserialize, Serialize)]
struct Message {
    role: String,
    content: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
struct RequestMessage {
    model: String,
    stream: bool,
    messages: Vec<Message>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
struct Delta {
    role: String,
    content: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
struct Choice {
    index: i64,
    delta: Delta,
    finish_reason: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
struct ResponseMessage {
    choices: Vec<Choice>,
}

pub fn _tokenize(value: &str) -> Result<usize> {
    let tokenizer = tokenizer_load()?;
    tokenize_with(value, &tokenizer, true)
}

fn tokenizer_load() -> Result<Tokenizer> {
    Tokenizer::from_pretrained("bert-base-multilingual-uncased", None)
        .map_err(|_e| Error::AiTokenizer(1204))
}

fn tokenize_with(value: &str, tokenizer: &Tokenizer, is_scalar: bool) -> Result<usize> {
    let encoding = tokenizer
        .encode(value, false)
        .map_err(|_e| Error::AiTokenizer(1205))?;
    let num = encoding.len();

    let real_num = if is_scalar {
        if num > SCALE {
            num / SCALE
        } else {
            1
        }
    } else {
        num
    };

    Ok(real_num)
}

pub async fn connect_remote(tx: Sender<Value>, req: Value) -> Result<()> {
    let request: RequestMessage = serde_json::from_value(req).unwrap();
    let tokenizer = tokenizer_load()?;

    let mut req_num = 0;
    for msg in request.messages {
        req_num += tokenize_with(&msg.content, &tokenizer, false).unwrap();
    }
    let real_num = if req_num > SCALE { req_num / SCALE } else { 1 };

    // open stream and send query to remote
    let mut stream = reqwest::get("http://localhost:11434/v1/chat/completions")
        .await
        .map_err(|_e| Error::AiTokenizer(1206))?
        .json_array_stream::<Value>(1024);

    while let Some(Ok(msg)) = stream.next().await {
        // TODO update spent real_num * price

        // send to client
        if tx.send(msg).await.is_err() {
            break;
        }
    }

    Ok(())
}

pub fn api_stream(req: Value) -> impl Stream<Item = Value> {
    let (tx, rx) = channel::<Value>(1024);

    tokio::spawn(connect_remote(tx, req));

    // Create a stream from the channel
    ReceiverStream::new(rx).boxed()
}
