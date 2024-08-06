use futures_util::{Stream, StreamExt};
use reqwest_streams::*;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use subql_indexer_utils::{error::Error, payg::MultipleQueryState, types::Result};
use tokenizers::tokenizer::Tokenizer;
use tokio::sync::mpsc::{channel, Sender};
use tokio_stream::wrappers::ReceiverStream;

use crate::payg::{before_query_multiple_state, post_query_multiple_state};

const SCALE: usize = 1;
const BATCH: usize = 10;

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

pub async fn connect_remote(
    endpoint: String,
    tx: Sender<String>,
    req: Value,
    state: MultipleQueryState,
    is_test: bool,
) -> Result<()> {
    let req_s = serde_json::to_string(&req).unwrap_or("".to_owned());
    let request: RequestMessage =
        serde_json::from_value(req).map_err(|_| Error::Serialize(1142))?;
    let tokenizer = tokenizer_load()?;

    let mut req_num = 0;
    for msg in request.messages {
        req_num += tokenize_with(&msg.content, &tokenizer, false)?;
    }

    // pay by real count
    if !is_test {
        pay_by_token(req_num, &tx, state.clone()).await?;
    }

    // open stream and send query to remote
    // http://localhost:11434/v1/chat/completions
    let client = reqwest::Client::new();
    let mut stream = client
        .post(endpoint)
        .body(req_s)
        .send()
        .await
        .map_err(|_e| Error::AiTokenizer(1206))?
        .json_array_stream::<Value>(1024);

    let mut count = 0;
    while let Some(Ok(msg)) = stream.next().await {
        count += 1;

        // pay by real count
        if count == BATCH {
            if !is_test {
                pay_by_token(count, &tx, state.clone()).await?;
            }
            count = 0;
        }

        // send to client
        if tx.send(build_data(msg)).await.is_err() {
            break;
        }
    }

    if count != 0 && !is_test {
        pay_by_token(count, &tx, state).await?;
    }

    Ok(())
}

pub fn api_stream(
    endpoint: String,
    req: Value,
    state: MultipleQueryState,
    is_test: bool,
) -> impl Stream<Item = String> {
    let (tx, rx) = channel::<String>(1024);

    tokio::spawn(async move {
        let tx1 = tx.clone();
        if let Err(err) = connect_remote(endpoint, tx1, req, state, is_test).await {
            let state = build_data(err.to_json());
            let _ = tx.send(state).await;
        }
    });

    // Create a stream from the channel
    ReceiverStream::new(rx).boxed()
}

fn build_data(raw: Value) -> String {
    let s = serde_json::to_string(&raw).unwrap_or("".to_owned());
    format!("data: {} \n\n", s)
}

async fn pay_by_token(num: usize, tx: &Sender<String>, state: MultipleQueryState) -> Result<()> {
    let real_num = if num > SCALE { num / SCALE } else { 1 };

    let (state, keyname, state_cache, inactive) =
        before_query_multiple_state(state, real_num as u64).await?;

    if inactive {
        let state = build_data(json!({
            "state": state.to_bs64()
        }));
        let _ = tx.send(state).await;
    }

    post_query_multiple_state(keyname, state_cache).await;

    Ok(())
}
