use ethers::prelude::*;
use subql_contracts::{state_channel, Network};

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

#[tokio::main]
async fn main() -> Result<(), ()> {
    let client = Provider::<Ws>::connect("wss://moonbeam-alpha.api.onfinality.io/public-ws")
        .await
        .unwrap();

    let last_block = client
        .get_block(BlockNumber::Latest)
        .await
        .unwrap()
        .unwrap()
        .number
        .unwrap();
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

    loop {
        tokio::select! {
            Some(e1) = stream_open.next() => {
                if let Ok((_open, log)) = e1 {
                    println!("OPEN at block {}", log.block_number);
                }
            }
            Some(e2) = stream_extend.next() => {
                if let Ok((_extend, log)) = e2 {
                    println!("EXTEND at block {}", log.block_number);
                }
            }
            Some(e3) = stream_fund.next() => {
                if let Ok((_fund, log)) = e3 {
                    println!("FUND at block {}", log.block_number);
                }
            }
            Some(e4) = stream_checkpoint.next() => {
                if let Ok((_checkpoint, log)) = e4 {
                    println!("CHECKPOINT at block {}", log.block_number);
                }
            }
            Some(e5) = stream_challenge.next() => {
                if let Ok((_challenge, log)) = e5 {
                    println!("CHALLENGE at block {}", log.block_number);
                }
            }
            Some(e6) = stream_respond.next() => {
                if let Ok((_respond, log)) = e6 {
                    println!("RESPOND at block {}", log.block_number);
                }
            }
            Some(e7) = stream_finalize.next() => {
                if let Ok((_finalize, log)) = e7 {
                    println!("FINALIZE at block {}", log.block_number);
                }
            }
            else => break,
        }
    }

    Ok(())
}
