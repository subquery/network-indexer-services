use std::time::Duration;

use libp2p::identity::{self, Keypair};
use tokio::time::sleep;

use crate::mod_libp2p::network::EventLoop;

pub mod behavior;
pub mod network;

pub async fn start_libp2p_process(controller_sk: &str) {
    let local_key = make_libp2p_keypair(controller_sk).await;
    tokio::spawn(async move {
        let mut backoff = Duration::from_secs(1);
        loop {
            match monitor_libp2p_connection(local_key.clone()).await {
                Ok(_) => {
                    break;
                }
                Err(_e) => {
                    sleep(backoff).await;
                    backoff = (backoff * 2).min(Duration::from_secs(60)); // Cap backoff
                }
            }
        }
    });
}

pub async fn make_libp2p_keypair(controller_sk: &str) -> Keypair {
    if let Ok(private_key_bytes) = hex::decode(&controller_sk) {
        if let Ok(secret_key) = identity::secp256k1::SecretKey::try_from_bytes(private_key_bytes) {
            identity::secp256k1::Keypair::from(secret_key).into()
        } else {
            make_fake_libp2p_keypair().await
        }
    } else {
        make_fake_libp2p_keypair().await
    }
}

pub async fn make_fake_libp2p_keypair() -> Keypair {
    let private_key_bytes =
        hex::decode("0000000000000000000000000000000000000000000000000000000000000001").unwrap();
    let secret_key = identity::secp256k1::SecretKey::try_from_bytes(private_key_bytes).unwrap();
    identity::secp256k1::Keypair::from(secret_key).into()
}

pub async fn monitor_libp2p_connection(
    local_key: Keypair,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let mut eventloop = EventLoop::new(local_key).await?;
    eventloop.run().await;
    Ok(())
}
