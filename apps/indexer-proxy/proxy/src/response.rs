use chrono::Utc;
use ethers::{
    abi::{encode, Tokenizable},
    signers::Signer,
    utils::keccak256,
};
use sha2::Digest;
use subql_indexer_utils::payg::{convert_sign_to_string, default_sign};

use crate::account::ACCOUNT;

pub async fn sign_response(data: &[u8]) -> String {
    let mut hasher = sha2::Sha256::new();
    hasher.update(&data);
    let bytes = hasher.finalize().to_vec();

    // sign the response
    let lock = ACCOUNT.read().await;
    let controller = lock.controller.clone();
    let indexer = lock.indexer.clone();
    drop(lock);

    let timestamp = Utc::now().timestamp();
    let payload = encode(&[
        indexer.into_token(),
        bytes.into_token(),
        timestamp.into_token(),
    ]);
    let hash = keccak256(payload);
    let sign = controller
        .sign_message(hash)
        .await
        .unwrap_or(default_sign());
    format!("{} {}", timestamp, convert_sign_to_string(&sign))
}
