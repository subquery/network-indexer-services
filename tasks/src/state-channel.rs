#[macro_use]
extern crate sqlx;

use ethers::prelude::*;
use subql_contracts::{state_channel, Network};

mod models;

#[allow(non_snake_case)]
#[derive(Clone, Debug, EthEvent)]
struct ChannelOpen {
    #[ethevent(indexed)]
    channelId: U256,
    indexer: Address,
    consumer: Address,
    total: U256,
    expiration: U256,
    deploymentId: Bytes,
}

#[allow(non_snake_case)]
#[derive(Clone, Debug, EthEvent)]
struct ChannelExtend {
    #[ethevent(indexed)]
    channelId: U256,
    expiration: U256,
}

#[allow(non_snake_case)]
#[derive(Clone, Debug, EthEvent)]
struct ChannelFund {
    #[ethevent(indexed)]
    channelId: U256,
    total: U256,
}

#[allow(non_snake_case)]
#[derive(Clone, Debug, EthEvent)]
struct ChannelCheckpoint {
    #[ethevent(indexed)]
    channelId: U256,
    spent: U256,
}

#[allow(non_snake_case)]
#[derive(Clone, Debug, EthEvent)]
struct ChannelChallenge {
    #[ethevent(indexed)]
    channelId: U256,
    spent: U256,
    expiration: U256,
}

#[allow(non_snake_case)]
#[derive(Clone, Debug, EthEvent)]
struct ChannelRespond {
    #[ethevent(indexed)]
    channelId: U256,
    spent: U256,
}

#[allow(non_snake_case)]
#[derive(Clone, Debug, EthEvent)]
struct ChannelFinalize {
    #[ethevent(indexed)]
    channelId: U256,
    total: U256,
    remain: U256,
}

#[allow(non_snake_case)]
#[derive(Clone, Debug, EthEvent)]
struct ChannelLabor {
    deploymentId: Bytes,
    indexer: Address,
    amount: U256,
}

#[tokio::main]
async fn main() -> Result<(), ()> {
    dotenv::dotenv().ok();
    let endpoint = std::env::var("ENDPOINT_WS").expect("ENDPOINT_WS is not set in .env file");
    let client = Provider::<Ws>::connect(endpoint).await.unwrap();

    models::setup_db().await;
    let last_block = models::init_chain_block().await;

    println!("last_block: {}", last_block);

    let contract = state_channel(client, Network::Moonbase).unwrap();

    let event_open = contract.event::<ChannelOpen>().from_block(last_block);
    let mut stream_open = event_open.stream().await.unwrap().with_meta();

    let event_extend = contract.event::<ChannelExtend>().from_block(last_block);
    let mut stream_extend = event_extend.stream().await.unwrap().with_meta();

    let event_fund = contract.event::<ChannelFund>().from_block(last_block);
    let mut stream_fund = event_fund.stream().await.unwrap().with_meta();

    let event_checkpoint = contract.event::<ChannelCheckpoint>().from_block(last_block);
    let mut stream_checkpoint = event_checkpoint.stream().await.unwrap().with_meta();

    let event_challenge = contract.event::<ChannelChallenge>().from_block(last_block);
    let mut stream_challenge = event_challenge.stream().await.unwrap().with_meta();

    let event_respond = contract.event::<ChannelRespond>().from_block(last_block);
    let mut stream_respond = event_respond.stream().await.unwrap().with_meta();

    let event_finalize = contract.event::<ChannelFinalize>().from_block(last_block);
    let mut stream_finalize = event_finalize.stream().await.unwrap().with_meta();

    let event_labor = contract.event::<ChannelLabor>().from_block(last_block);
    let mut stream_labor = event_labor.stream().await.unwrap().with_meta();

    loop {
        tokio::select! {
            Some(e1) = stream_open.next() => {
                if let Ok((_open, log)) = e1 {
                    println!("OPEN at block {}", log.block_number);
                }
            }
            Some(e2) = stream_extend.next() => {
                if let Ok((extend, log)) = e2 {
                    models::channel_extend(extend.channelId, extend.expiration).await;
                    models::update_chain_block(log.block_number.as_u64()).await;
                    println!("EXTEND at block {}", log.block_number);
                }
            }
            Some(e3) = stream_fund.next() => {
                if let Ok((fund, log)) = e3 {
                    models::channel_fund(fund.channelId, fund.total).await;
                    models::update_chain_block(log.block_number.as_u64()).await;
                    println!("FUND at block {}", log.block_number);
                }
            }
            Some(e4) = stream_checkpoint.next() => {
                if let Ok((checkpoint, log)) = e4 {
                    models::channel_checkpoint(checkpoint.channelId, checkpoint.spent).await;
                    models::update_chain_block(log.block_number.as_u64()).await;
                    println!("CHECKPOINT at block {}", log.block_number);
                }
            }
            Some(e5) = stream_challenge.next() => {
                if let Ok((challenge, log)) = e5 {
                    models::channel_challenge(challenge.channelId, challenge.spent).await;
                    models::update_chain_block(log.block_number.as_u64()).await;
                    println!("CHALLENGE at block {}", log.block_number);
                }
            }
            Some(e6) = stream_respond.next() => {
                if let Ok((respond, log)) = e6 {
                    models::channel_respond(respond.channelId, respond.spent).await;
                    models::update_chain_block(log.block_number.as_u64()).await;
                    println!("RESPOND at block {}", log.block_number);
                }
            }
            Some(e7) = stream_finalize.next() => {
                if let Ok((finalize, log)) = e7 {
                    models::channel_finalize(finalize.channelId, finalize.total, finalize.remain).await;
                    models::update_chain_block(log.block_number.as_u64()).await;
                    println!("FINALIZE at block {}", log.block_number);
                }
            }
            Some(e8) = stream_labor.next() => {
                if let Ok((labor, log)) = e8 {
                    models::channel_labor(labor.deploymentId, labor.indexer, labor.amount, log.block_number.as_u64()).await;
                    models::update_chain_block(log.block_number.as_u64()).await;
                    println!("LABOR at block {}", log.block_number);
                }
            }
            else => break,
        }
    }

    Ok(())
}
