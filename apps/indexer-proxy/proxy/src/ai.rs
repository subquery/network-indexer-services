// This file is part of SubQuery.

// Copyright (C) 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later WITH Classpath-exception-2.0

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.

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
const BERT_BASE_MULTILINGUAL_UNCASED: &[u8] = include_bytes!("../tokenizer.json");

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
    Tokenizer::from_bytes(BERT_BASE_MULTILINGUAL_UNCASED).map_err(|_e| Error::AiTokenizer(1204))
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
    state: Option<MultipleQueryState>,
) -> Result<()> {
    let req_s = serde_json::to_string(&req).unwrap_or("".to_owned());
    let request: RequestMessage =
        serde_json::from_value(req).map_err(|_| Error::Serialize(1142))?;

    let mut req_num = 0;
    if let Ok(tokenizer) = tokenizer_load() {
        for msg in request.messages {
            req_num += tokenize_with(&msg.content, &tokenizer, false)?;
        }
    } else {
        for msg in request.messages {
            req_num += msg.content.len();
        }
    }

    // pay by real count
    if state.is_some() {
        pay_by_token(req_num, &tx, state.as_ref().unwrap().clone(), true).await?;
    }

    // open stream and send query to remote
    // http://localhost:11434/v1/chat/completions
    let client = reqwest::Client::new();
    let mut stream = client
        .post(endpoint)
        .body(req_s)
        .send()
        .await
        .map_err(|_e| Error::AiModel(1206))?
        .json_array_stream::<Value>(1024);

    let mut count = 0;
    while let Some(Ok(msg)) = stream.next().await {
        count += 1;

        // pay by real count
        if count == BATCH {
            if state.is_some() {
                pay_by_token(count, &tx, state.as_ref().unwrap().clone(), false).await?;
            }
            count = 0;
        }

        // send to client
        if tx.send(build_data(msg)).await.is_err() {
            break;
        }
    }

    if count != 0 && state.is_some() {
        pay_by_token(count, &tx, state.unwrap(), true).await?;
    }

    Ok(())
}

pub fn api_stream(
    endpoint: String,
    req: Value,
    state: Option<MultipleQueryState>,
) -> impl Stream<Item = String> {
    let (tx, rx) = channel::<String>(1024);

    tokio::spawn(async move {
        let tx1 = tx.clone();
        if let Err(err) = connect_remote(endpoint, tx1, req, state).await {
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

async fn pay_by_token(
    num: usize,
    tx: &Sender<String>,
    state: MultipleQueryState,
    must_send: bool,
) -> Result<()> {
    let real_num = if num > SCALE { num / SCALE } else { 1 };

    let (state, keyname, state_cache, inactive) =
        before_query_multiple_state(state, real_num as u64).await?;

    if must_send || inactive {
        let state = build_data(json!({
            "state": state.to_bs64()
        }));
        let _ = tx.send(state).await;
    }

    post_query_multiple_state(keyname, state_cache).await;

    Ok(())
}
