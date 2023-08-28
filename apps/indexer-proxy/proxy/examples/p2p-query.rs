use ethers::{
    abi::{Token, Tokenizable},
    prelude::*,
};
use once_cell::sync::Lazy;
use std::env::args;
use std::io::Result;
use std::path::PathBuf;
use std::sync::Arc;
use std::{collections::HashMap, net::SocketAddr};
use subql_contracts::{service_agreement_registry, Network};
use subql_indexer_utils::{
    p2p::{Event, JoinData, ROOT_GROUP_ID, ROOT_NAME},
    tools::deployment_cid,
};
use tdn::{
    prelude::{
        channel_rpc_channel, start_with_config_and_key, ChannelRpcSender, Config, GroupId,
        HandleResult, NetworkType, Peer, PeerId, PeerKey, ReceiveMessage, RecvType, SendMessage,
        SendType,
    },
    types::{
        group::hash_to_group_id,
        primitives::{new_io_error, vec_check_push, vec_remove_item},
        rpc::{json, rpc_request, RpcError, RpcHandler, RpcParam},
    },
};
use tokio::sync::{mpsc::Sender, RwLock};

static P2P_SENDER: Lazy<RwLock<Vec<ChannelRpcSender>>> = Lazy::new(|| RwLock::new(vec![]));

async fn send(method: &str, params: Vec<RpcParam>, gid: GroupId) {
    let senders = P2P_SENDER.read().await;
    if !senders.is_empty() {
        senders[0].send(rpc_request(0, method, params, gid)).await;
    }
}

async fn sync_send(method: &str, params: Vec<RpcParam>, gid: GroupId) -> std::io::Result<RpcParam> {
    let senders = P2P_SENDER.read().await;
    if !senders.is_empty() {
        senders[0]
            .sync_send(rpc_request(0, method, params, gid), 5000)
            .await
            .map_err(|_| new_io_error("SEND FAILURE"))
    } else {
        Err(new_io_error("NO NETWORK"))
    }
}

pub async fn test_close_agreement(
    consumer: Address,
    indexer: Address,
    controller: Address,
    network: Network,
) {
    let default_endpoint = network.config().rpc_urls[0].clone();
    let endpoint = std::env::var("ENDPOINT_HTTP").unwrap_or(default_endpoint);
    let provider = Arc::new(Provider::<Http>::try_from(endpoint).unwrap());
    let contract = service_agreement_registry(provider, network).unwrap();
    println!("Service agreement contract: {:?}", contract.address());
    let result: U256 = contract
        .method::<_, U256>("indexerCsaLength", (indexer,))
        .unwrap()
        .call()
        .await
        .unwrap();
    let mut agreement_id: Option<U256> = None;
    let mut deployment_id: Option<String> = None;
    for i in 0..result.as_u32() {
        let aid: U256 = contract
            .method::<_, U256>("closedServiceAgreementIds", (indexer, i))
            .unwrap()
            .call()
            .await
            .unwrap();
        let result: Token = contract
            .method::<_, Token>("getClosedServiceAgreement", (aid,))
            .unwrap()
            .call()
            .await
            .unwrap();
        let tokens = result.into_tuple().unwrap();
        let deployment = deployment_cid(&H256::from_token(tokens[2].clone()).unwrap());
        let aconsumer = tokens[0].clone().into_address().unwrap();
        if aconsumer == consumer {
            agreement_id = Some(aid);
            deployment_id = Some(deployment);
        }
    }

    if agreement_id.is_none() {
        println!("NO active close agreement");
        return;
    }
    let agreement = agreement_id.unwrap().to_string();
    let deployment = deployment_id.unwrap();
    let _deployment_gid = hash_to_group_id(deployment.as_bytes());

    println!("Join the deployment: {}", deployment);
    send("project-join", vec![json!(deployment)], ROOT_GROUP_ID).await;

    println!("START Query the project limit ...");
    let params = vec![json!(format!("{:?}", controller)), json!(agreement)];
    let res = sync_send("project-limit", params, ROOT_GROUP_ID)
        .await
        .unwrap();
    println!("RESPONSE: {}", res);

    let query = json!({ "query": "query { _metadata { indexerHealthy chain } }" });
    println!("START Query the project: {} ...", query);
    let params = vec![
        json!(format!("{:?}", controller)),
        json!(agreement),
        json!(query.to_string()),
    ];
    let res = sync_send(
        "project-query",
        params,
        hash_to_group_id(deployment.as_bytes()),
    )
    .await
    .unwrap();
    println!("RESPONSE: {}", res);

    println!("Auto run close agreement test success");
}

#[tokio::main]
async fn main() -> std::io::Result<()> {
    if args().len() != 5 {
        println!("cargo run --example p2p-query consumer_sk indexer_address controller_address controller_socket");
        return Ok(());
    }

    let key = PeerKey::from_sec_key(args().nth(1).unwrap().as_str().try_into().unwrap());
    let consumer: Address = key.peer_id().to_hex().parse().unwrap();
    let indexer: Address = args().nth(2).unwrap().parse().unwrap();
    let controller: Address = args().nth(3).unwrap().parse().unwrap();
    let controller_addr: SocketAddr = args().nth(4).unwrap().parse().unwrap();

    let network = Network::Testnet;

    // start new network
    let (out_send, mut out_recv, inner_send, inner_recv) = channel_rpc_channel();
    let mut senders = P2P_SENDER.write().await;
    if !senders.is_empty() {
        senders.pop();
    }
    senders.push(inner_send);
    drop(senders);
    tokio::spawn(async move {
        while let Some(msg) = out_recv.recv().await {
            println!("GOT NOT HANDLE RPC: {:?}", msg);
        }
    });

    let mut config = Config::default();
    config.only_stable_data = true;
    config.db_path = Some(PathBuf::from("./.data/test"));
    config.rpc_http = None;
    config.p2p_peer = Peer::peer(key.peer_id());
    config.rpc_channel = Some((out_send, inner_recv));
    config.group_ids = vec![ROOT_GROUP_ID];

    let (peer_addr, send, mut out_recv) = start_with_config_and_key(config, key).await.unwrap();
    println!("Peer id: {:?}", peer_addr);

    let mut init_groups = HashMap::new();
    init_groups.insert(ROOT_GROUP_ID, (ROOT_NAME.to_owned(), vec![]));
    let ledger = Arc::new(RwLock::new(Ledger {
        groups: init_groups,
    }));

    let rpc_handler = rpc_handler(ledger.clone());

    // tests
    tokio::spawn(async move {
        println!("Waiting 5s will auto run close agreement test");
        tokio::time::sleep(std::time::Duration::from_secs(5)).await;
        test_close_agreement(consumer, indexer, controller, network).await;
    });

    bootstrap(&send, vec![controller_addr]).await;
    while let Some(message) = out_recv.recv().await {
        match message {
            ReceiveMessage::Group(gid, msg) => {
                if let Ok(result) = handle_group(gid, msg, ledger.clone()).await {
                    handle_result(result, &send, 0, true).await;
                }
            }
            ReceiveMessage::Rpc(uid, mut params, is_ws) => {
                let mut new_params = vec![];
                new_params.push(RpcParam::from(uid));
                if let Some(p) = params["params"].as_array() {
                    new_params.extend_from_slice(p);
                }
                params["params"] = RpcParam::from(new_params);
                if let Ok(result) = rpc_handler.handle(params).await {
                    handle_result(result, &send, uid, is_ws).await;
                }
            }
            _ => {
                println!("Nothing");
            }
        }
    }

    Ok(())
}

struct Ledger {
    groups: HashMap<GroupId, (String, Vec<PeerId>)>,
}

struct State(Arc<RwLock<Ledger>>);

fn rpc_handler(ledger: Arc<RwLock<Ledger>>) -> RpcHandler<State> {
    let mut rpc_handler = RpcHandler::new(State(ledger));

    rpc_handler.add_method(
        "project-join",
        |_gid: GroupId, params: Vec<RpcParam>, state: Arc<State>| async move {
            if params.len() != 1 {
                return Err(RpcError::ParseError);
            }
            let project = params[0].as_str().ok_or(RpcError::ParseError)?;
            let gid = hash_to_group_id(project.as_bytes());

            let mut results = HandleResult::new();
            if state.0.read().await.groups.contains_key(&gid) {
                return Ok(results);
            }

            let mut ledger = state.0.write().await;
            ledger.groups.insert(gid, (project.to_owned(), vec![]));
            let (_, root_peers) = ledger.groups.get(&ROOT_GROUP_ID).cloned().unwrap();
            drop(ledger);

            // broadcast event in root group
            results.networks.push(NetworkType::AddGroup(gid));
            let bytes = Event::ProjectJoin(gid).to_bytes();
            for peer in root_peers {
                results
                    .groups
                    .push((ROOT_GROUP_ID, SendType::Event(0, peer, bytes.clone())));
            }

            Ok(results)
        },
    );

    rpc_handler.add_method(
        "project-limit",
        |gid: GroupId, params: Vec<RpcParam>, _state: Arc<State>| async move {
            let uid = params[0].as_u64().ok_or(RpcError::ParseError)?;
            let remote = params[1].as_str().ok_or(RpcError::ParseError)?;
            let agreement = params[2].as_str().ok_or(RpcError::ParseError)?.to_owned();
            let pid = PeerId::from_hex(remote)?;

            let data = Event::CloseAgreementLimit(uid, agreement).to_bytes();
            Ok(HandleResult::group(
                gid,
                SendType::Event(0, pid, data.clone()),
            ))
        },
    );

    rpc_handler.add_method(
        "project-query",
        |gid: GroupId, params: Vec<RpcParam>, _state: Arc<State>| async move {
            let uid = params[0].as_u64().ok_or(RpcError::ParseError)?;
            let remote = params[1].as_str().ok_or(RpcError::ParseError)?;
            let agreement = params[2].as_str().ok_or(RpcError::ParseError)?.to_owned();
            let query = params[3].as_str().ok_or(RpcError::ParseError)?.to_owned();
            let pid = PeerId::from_hex(remote)?;

            let data = Event::CloseAgreementQuery(uid, agreement, query).to_bytes();
            Ok(HandleResult::group(
                gid,
                SendType::Event(0, pid, data.clone()),
            ))
        },
    );

    rpc_handler
}

async fn handle_group(
    gid: GroupId,
    msg: RecvType,
    ledger: Arc<RwLock<Ledger>>,
) -> Result<HandleResult> {
    let mut results = HandleResult::new();
    if !ledger.read().await.groups.contains_key(&gid) {
        return Ok(results);
    }

    match msg {
        RecvType::Result(peer, is_ok, bytes) => {
            println!(
                "Receive project {} peer {} join result: {}",
                gid,
                peer.id.short_show(),
                is_ok,
            );
            if let Ok(data) = bincode::deserialize::<JoinData>(&bytes) {
                let peer_id = peer.id;
                let mut ledger = ledger.write().await;
                for project in data.0 {
                    let gid = hash_to_group_id(project.as_bytes());
                    if let Some((_, peers)) = ledger.groups.get_mut(&gid) {
                        vec_check_push(peers, peer_id);
                    }
                }
                drop(ledger);
            }
        }
        RecvType::Event(peer_id, data) => {
            println!(
                "Receive project {} event from {}",
                gid,
                peer_id.short_show()
            );
            let event = Event::from_bytes(&data)?;
            match event {
                Event::ProjectJoin(gid) => {
                    let mut ledger = ledger.write().await;
                    if let Some((_, peers)) = ledger.groups.get_mut(&gid) {
                        vec_check_push(peers, peer_id);
                        let e = Event::ProjectJoinRes;
                        let msg = SendType::Event(0, peer_id, e.to_bytes());
                        results.groups.push((gid, msg));
                    }
                    drop(ledger);
                }
                Event::ProjectJoinRes => {
                    let mut ledger = ledger.write().await;
                    if let Some((_, peers)) = ledger.groups.get_mut(&gid) {
                        vec_check_push(peers, peer_id);
                    }
                    drop(ledger);
                }
                Event::ProjectLeave => {
                    // update ledger
                    let mut ledger = ledger.write().await;
                    if let Some((_, peers)) = ledger.groups.get_mut(&gid) {
                        vec_remove_item(peers, &peer_id);
                    }
                    drop(ledger);
                }
                Event::ProjectHealthy(metadata) => {
                    let res: RpcParam = serde_json::from_str(&metadata)?;
                    println!("GOT project healthy report: {}", res);
                }
                Event::CloseAgreementLimitRes(uid, data) => {
                    let state: RpcParam = serde_json::from_str(&data)?;
                    results.rpcs.push(json!( {
                        "uid": uid,
                        "value": state
                    }));
                }
                Event::CloseAgreementQueryRes(uid, data) => {
                    let data: RpcParam = serde_json::from_str(&data)?;
                    results.rpcs.push(json!({
                        "uid": uid,
                        "value": data
                    }));
                }
                _ => {
                    println!("Not handle event: {:?}", event);
                }
            }
        }
        _ => {}
    }

    Ok(results)
}

async fn bootstrap(sender: &Sender<SendMessage>, seeds: Vec<SocketAddr>) {
    let self_bytes = bincode::serialize(&JoinData(vec![ROOT_NAME.to_owned()])).unwrap_or(vec![]);

    for seed in seeds {
        let peer = Peer::socket(seed);
        sender
            .send(SendMessage::Group(
                ROOT_GROUP_ID,
                SendType::Connect(0, peer, self_bytes.clone()),
            ))
            .await
            .unwrap();
    }
}

async fn handle_result(
    result: HandleResult,
    sender: &Sender<SendMessage>,
    mut uid: u64,
    mut is_ws: bool,
) {
    let HandleResult {
        mut owns,
        mut rpcs,
        mut groups,
        mut networks,
    } = result;

    loop {
        if rpcs.len() != 0 {
            let mut msg = rpcs.remove(0);
            if msg.is_object() {
                uid = msg["uid"].as_u64().unwrap_or(0);
                msg = msg["value"].take();
                is_ws = false;
            }
            sender
                .send(SendMessage::Rpc(uid, msg, is_ws))
                .await
                .unwrap();
        } else {
            break;
        }
    }

    loop {
        if owns.len() != 0 {
            let msg = owns.remove(0);
            sender.send(SendMessage::Own(msg)).await.unwrap();
        } else {
            break;
        }
    }

    loop {
        if groups.len() != 0 {
            let (gid, msg) = groups.remove(0);
            sender.send(SendMessage::Group(gid, msg)).await.unwrap();
        } else {
            break;
        }
    }

    // must last send, because it will has stop type.
    loop {
        if networks.len() != 0 {
            let msg = networks.remove(0);
            sender.send(SendMessage::Network(msg)).await.unwrap();
        } else {
            break;
        }
    }
}
