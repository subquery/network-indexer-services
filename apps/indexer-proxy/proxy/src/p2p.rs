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

use base64::{engine::general_purpose, Engine as _};
// use chamomile_types::Peer as ChamomilePeer;
use once_cell::sync::Lazy;
use std::collections::BTreeMap;
// use serde::Serialize;
use std::io::Result;
use std::sync::Arc;
use std::{collections::HashMap, env, env::args, fs, path::Path, str::FromStr, time::Duration};

use subql_indexer_utils::{
    error::Error,
    p2p::{
        generate_swarm, AgentBehavior, AgentBehaviorEvent, Event, GreeRequest, GreetResponse,
        GroupEvent, ROOT_GROUP_ID, ROOT_NAME,
    },
    payg::QueryState,
};
use tdn::{
    //     prelude::{
    //         channel_rpc_channel, start_with_config_and_key, ChannelRpcSender, Config, GroupId,
    //         HandleResult, NetworkType, Peer, PeerId, PeerKey, ReceiveMessage, RecvType, SendMessage,
    //         SendType,
    //     },
    types::{
        // group::hash_to_group_id,
        primitives::{vec_check_push, vec_remove_item},
        //         rpc::{rpc_request, RpcError, RpcHandler, RpcParam},
    },
};

use serde_json::{json, Value};
use tokio::{
    sync::{
        mpsc::{self, Receiver, Sender},
        oneshot, RwLock,
    },
    // time::sleep,
};

use crate::{
    // account::{get_indexer, indexer_healthy},
    auth::{check_and_get_agreement_limit, check_and_save_agreement},
    cli::COMMAND,
    // contracts::get_consumer_host_peer,
    metrics::{
        // get_timer_metrics,
        MetricsNetwork,
        MetricsQuery,
    },
    payg::{merket_price, open_state, query_single_state},
    // primitives::*,
    project::get_project,
};

use anyhow::{anyhow, Result as OtherResult};
use futures::{
    io::{ReadHalf, WriteHalf},
    AsyncReadExt, AsyncWriteExt,
};
use libp2p::{
    core::transport::upgrade::Version,
    futures::StreamExt,
    gossipsub,
    identify::{Behaviour as IdentifyBehavior, Config as IdentifyConfig, Event as IdentifyEvent},
    identity::{self, Keypair},
    kad::{
        store::MemoryStore as KadInMemory, Behaviour as KadBehavior, Config as KadConfig,
        Event as KadEvent, RoutingUpdate,
    },
    mdns,
    noise::Config as NoiseConfig,
    pnet::{PnetConfig, PreSharedKey},
    request_response::{
        cbor::Behaviour as RequestResponseBehavior, Config as RequestResponseConfig,
        Event as RequestResponseEvent, Message as RequestResponseMessage,
        ProtocolSupport as RequestResponseProtocolSupport,
    },
    swarm::SwarmEvent,
    tcp,
    yamux::Config as YamuxConfig,
    Multiaddr, PeerId, Stream, StreamProtocol, Swarm, SwarmBuilder, Transport,
};
use libp2p_stream::{self as stream, Behaviour as StreamBehaviour};

use either::Either;

const RECV_PROTOCOL: StreamProtocol = StreamProtocol::new("/recv_metrics");

// p2p sender via libp2p gossipsub
pub static GOSSIPSUB_P2P_SENDER: Lazy<RwLock<Option<mpsc::Sender<Vec<u8>>>>> =
    Lazy::new(|| RwLock::new(None));

pub async fn setup_gossipsub_sender(sender: mpsc::Sender<Vec<u8>>) {
    let mut senders = GOSSIPSUB_P2P_SENDER.write().await;
    *senders = Some(sender);
    drop(senders);
}

pub async fn gossipsub_send_msg(payload: Vec<u8>) -> OtherResult<()> {
    let guard = GOSSIPSUB_P2P_SENDER.read().await;
    if let Some(sender) = &*guard {
        sender
            .try_send(payload)
            .map_err(|e| anyhow!(e.to_string()))?;
        Ok(())
    } else {
        Err(anyhow!("no sender found, may be network broken")) // Use anyhow to create the error
    }
}

// (peer_id sender) via libp2p_stream
pub static STREAM_P2P_SENDER: Lazy<RwLock<BTreeMap<PeerId, mpsc::Sender<Vec<u8>>>>> =
    Lazy::new(|| RwLock::new(BTreeMap::new()));

pub async fn add_peer_stream(peer: PeerId, sender: mpsc::Sender<Vec<u8>>) {
    let mut senders = STREAM_P2P_SENDER.write().await;
    senders.insert(peer, sender);
    drop(senders);
}

pub async fn remove_peer_stream(peer: &PeerId) {
    let mut senders = STREAM_P2P_SENDER.write().await;
    senders.remove(peer);
}

// send message to one peerid via libp2p_stream
pub async fn stream_send(peer: &PeerId, payload: Vec<u8>) {
    let senders = STREAM_P2P_SENDER.read().await;
    if let Some(stream_sender) = senders.get(peer) {
        _ = stream_sender.try_send(payload);
    }
    drop(senders);
}

// pub async fn stop_network() {
//     let senders = P2P_SENDER.read().await;
//     if senders.is_empty() {
//         info!("NONE NETWORK, NOT STOP");
//     } else {
//         debug!("RESTART NEW P2P NETWORK");
//         senders[0].send(rpc_request(0, "p2p-stop", vec![], 0)).await;
//         drop(senders);
//         sleep(Duration::from_secs(P2P_RESTART_TIME)).await;
//     }
// }

// pub async fn report_conflict(
//     deployment: String,
//     channel: String,
//     conflict: u64,
//     start: i64,
//     end: i64,
// ) {
//     let senders = P2P_SENDER.read().await;
//     if senders.is_empty() {
//         warn!("NONE NETWORK WHEN REPORT CONFLICT");
//     } else {
//         senders[0]
//             .send_timeout(
//                 rpc_request(
//                     0,
//                     "payg-report-conflict",
//                     vec![
//                         deployment.into(),
//                         channel.into(),
//                         conflict.into(),
//                         start.into(),
//                         end.into(),
//                     ],
//                     0,
//                 ),
//                 100,
//             )
//             .await;
//         drop(senders);
//     }
// }

// async fn check_stable() {
//     loop {
//         sleep(Duration::from_secs(P2P_STABLE_TIME)).await;
//         let senders = P2P_SENDER.read().await;
//         if senders.is_empty() {
//             drop(senders);
//             continue;
//         } else {
//             debug!("Check stable connections");
//             senders[0]
//                 .send_timeout(rpc_request(0, "p2p-stable", vec![], 0), 100)
//                 .await;
//         }
//         drop(senders);
//     }
// }

// async fn report_metrics() {
//     loop {
//         sleep(Duration::from_secs(P2P_METRICS_TIME)).await;
//         let senders = P2P_SENDER.read().await;
//         if senders.is_empty() {
//             drop(senders);
//             continue;
//         } else {
//             debug!("Report projects metrics");
//             senders[0]
//                 .send(rpc_request(0, "project-report-metrics", vec![], 0))
//                 .await;
//         }
//         drop(senders);
//     }
// }

// async fn report_status() {
//     loop {
//         sleep(Duration::from_secs(P2P_METRICS_STATUS_TIME)).await;
//         let senders = P2P_SENDER.read().await;
//         if senders.is_empty() {
//             drop(senders);
//             continue;
//         } else {
//             debug!("Report projects status");
//             senders[0]
//                 .send_timeout(rpc_request(0, "project-report-status", vec![], 0), 100)
//                 .await;
//         }
//         drop(senders);
//     }
// }

// async fn broadcast_healthy() {
//     loop {
//         sleep(Duration::from_secs(P2P_BROADCAST_HEALTHY_TIME)).await;
//         let senders = P2P_SENDER.read().await;
//         if senders.is_empty() {
//             drop(senders);
//             continue;
//         } else {
//             debug!("Report projects healthy");
//             senders[0]
//                 .send_timeout(rpc_request(0, "project-broadcast-healthy", vec![], 0), 100)
//                 .await;
//         }
//         drop(senders);
//     }
// }

// pub fn listen() {
//     tokio::spawn(report_metrics());
//     tokio::spawn(report_status());
//     tokio::spawn(check_stable());
//     tokio::spawn(broadcast_healthy());
// }

// pub async fn start_network(key: PeerKey) {
//     // start new network
//     let (out_send, mut out_recv, inner_send, inner_recv) = channel_rpc_channel();
//     let mut senders = P2P_SENDER.write().await;
//     if !senders.is_empty() {
//         senders.pop();
//     }
//     senders.push(inner_send);
//     drop(senders);
//     tokio::spawn(async move {
//         while let Some(msg) = out_recv.recv().await {
//             warn!("GOT NOT HANDLE RPC: {:?}", msg);
//         }
//     });

//     let mut config = Config::default();
//     config.only_stable_data = false;
//     config.db_path = Some(PathBuf::from("./.data/p2p"));
//     config.rpc_http = None;
//     config.p2p_peer = Peer::socket(COMMAND.p2p());
//     config.rpc_channel = Some((out_send, inner_recv));
//     config.group_ids = vec![ROOT_GROUP_ID];

//     let (peer_addr, send, mut out_recv) = start_with_config_and_key(config, key).await.unwrap();
//     debug!("Peer id: {:?}", peer_addr);

//     let mut init_groups = HashMap::new();
//     init_groups.insert(ROOT_GROUP_ID, (ROOT_NAME.to_owned(), vec![]));
//     let ledger = Arc::new(RwLock::new(Ledger {
//         consumer_host_service: (PeerId::default(), false),
//         telemetries: COMMAND.telemetries().iter().map(|v| (*v, false)).collect(),
//         groups: init_groups,
//     }));
//     bootstrap(&send).await;

//     let rpc_handler = rpc_handler(ledger.clone());
//     while let Some(message) = out_recv.recv().await {
//         match message {
//             ReceiveMessage::Group(gid, msg) => {
//                 if let Ok(result) = handle_group(gid, msg, ledger.clone()).await {
//                     handle_result(result, &send, 0, true).await;
//                 }
//             }
//             ReceiveMessage::Rpc(uid, params, is_ws) => {
//                 if let Ok(result) = rpc_handler.handle(params).await {
//                     handle_result(result, &send, uid, is_ws).await;
//                 }
//             }
//             ReceiveMessage::NetworkLost => {
//                 debug!("No network connections, will re-connect");
//                 bootstrap(&send).await;
//             }
//             ReceiveMessage::Own(_) => {
//                 debug!("Nothing about own");
//             }
//         }
//     }
// }

pub async fn libp2p_start_network(network: String) -> OtherResult<()> {
    let key_string = std::env::var("LIBP2P_KEY").expect("LIBP2P_KEY missing in .env");
    let hex_data = hex::decode(key_string).unwrap();
    let keypair = identity::Keypair::from_protobuf_encoding(&hex_data).unwrap();

    let mut init_groups = HashMap::new();
    init_groups.insert(ROOT_GROUP_ID, (ROOT_NAME.to_owned(), vec![]));
    let ledger = Arc::new(RwLock::new(Ledger {
        consumer_host_service: (PeerId::random(), false),
        telemetries: COMMAND.telemetries().iter().map(|v| (*v, false)).collect(),
        groups: init_groups,
    }));
    let ipfs_path = get_ipfs_path();
    // println!("using IPFS_PATH {ipfs_path:?}");
    let psk: Option<PreSharedKey> = get_psk(&ipfs_path)?
        .map(|text| PreSharedKey::from_str(&text))
        .transpose()?;

    let mut swarm = generate_swarm(keypair.clone(), psk).unwrap();

    swarm.listen_on("/ip4/0.0.0.0/udp/5500/quic-v1".parse()?)?;

    println!("swarm is {:?}", swarm.network_info());

    let mut incoming_streams = swarm
        .behaviour()
        .stream
        .new_control()
        .accept(RECV_PROTOCOL)
        .unwrap();

    let topic = gossipsub::IdentTopic::new("test-net");
    // subscribes to our topic
    swarm.behaviour_mut().gossipsub.subscribe(&topic)?;

    tokio::spawn(async move {
        while let Some((_peer, stream)) = incoming_streams.next().await {
            let network_clone = network.clone();
            let ledger_clone = ledger.clone();
            tokio::spawn(async move {
                handle_msg(stream, network_clone, ledger_clone).await;
            });
        }
    });

    let (tx, mut rx) = mpsc::channel(100);
    setup_gossipsub_sender(tx).await;
    tokio::spawn(async move {
        loop {
            tokio::select! {
              _ = handle_swarm_event(keypair.clone(), &mut swarm) => {},
              Some(line) = rx.recv() => {
                if let Err(e) = swarm.behaviour_mut().gossipsub.publish(topic.clone(), line){
                    println!("Publish error: {e:?}");
                  }
              },
            }
        }
    });

    Ok(())
}

async fn handle_swarm_event(local_key: Keypair, swarm: &mut Swarm<AgentBehavior>) {
    match swarm.select_next_some().await {
        SwarmEvent::Behaviour(AgentBehaviorEvent::Gossipsub(event)) => {
            handle_gossipsub_event(event).await
        }
        SwarmEvent::NewListenAddr {
            listener_id,
            address,
        } => info!("NewListenAddr: {listener_id:?} | {address:?}"),
        _event => {
            println!("Unhandled swarm event: {:?}", _event);
        }
    }
}

async fn handle_gossipsub_event(event: gossipsub::Event) {
    println!("gossipsub event is {:?}", event);
}

async fn handle_msg(stream: Stream, _network: String, ledger: Arc<RwLock<Ledger>>) {
    let (rd, wr) = stream.split();

    let (stop_tx1, stop_rx1) = oneshot::channel();
    let (stop_tx2, stop_rx2) = oneshot::channel();

    let (reader_send, reader_recv) = mpsc::channel(128);
    let (wirter_send, writer_recv) = mpsc::channel(128);

    tokio::spawn(handle_reader(rd, stop_rx1, stop_tx2, reader_send));
    tokio::spawn(handle_group_event(reader_recv, wirter_send, ledger));
    tokio::spawn(handle_writer(wr, stop_rx2, stop_tx1, writer_recv));
}

async fn handle_reader(
    mut rd: ReadHalf<Stream>,
    mut stop_rx: oneshot::Receiver<()>,
    send_tx: oneshot::Sender<()>,
    reader_send: Sender<GroupEvent>,
) {
    loop {
        tokio::select! {
          _ = do_handle_reader(&mut rd, reader_send.clone()) => {},
          _ = &mut stop_rx => {
            println!("handle_reader received stop signal.");
            break;
          }
        }
    }

    _ = send_tx.send(());
}

async fn do_handle_reader(rd: &mut ReadHalf<Stream>, reader_send: Sender<GroupEvent>) {
    let mut received: usize = 0;
    let mut buf = [0u8; 4];

    loop {
        match rd.read(&mut buf).await {
            Ok(0) => break,
            Ok(_size) => {
                let len: usize = u32::from_be_bytes(buf) as usize;
                let mut read_bytes = vec![0u8; len];
                while let Ok(bytes_size) = rd.read(&mut read_bytes[received..]).await {
                    received += bytes_size;
                    if received > len {
                        break;
                    }

                    if received != len {
                        continue;
                    }

                    if let Ok(received_json) = String::from_utf8(read_bytes[..received].to_vec()) {
                        if let Ok(group_event) = serde_json::from_str::<GroupEvent>(&received_json)
                        {
                            if let Err(_) = reader_send.try_send(group_event) {
                                break;
                            }
                        } else {
                            break;
                        }
                    } else {
                        break;
                    }
                }
                buf = [0u8; 4];
                received = 0;
            }
            _ => {
                break;
            }
        }
    }
}

async fn handle_group_event(
    mut reader_recv: Receiver<GroupEvent>,
    writer_send: Sender<Vec<u8>>,
    ledger: Arc<RwLock<Ledger>>,
) {
    let mut results = vec![];
    while let Ok(group_event) = reader_recv.try_recv() {
        let GroupEvent {
            group_id,
            peer_id,
            event,
        } = group_event;

        let project = if let Some((project, _)) = ledger.read().await.groups.get(&group_id) {
            project.to_owned()
        } else {
            continue;
        };
        _ = handle_new_event(
            event,
            ledger.clone(),
            peer_id,
            &mut results,
            group_id,
            project,
        )
        .await;

        for data in results.iter() {
            _ = writer_send.send(data.clone()).await;
        }
    }
}

async fn handle_writer(
    mut wr: WriteHalf<Stream>,
    mut stop_rx: oneshot::Receiver<()>,
    send_tx: oneshot::Sender<()>,
    mut writer_recv: Receiver<Vec<u8>>,
) {
    loop {
        tokio::select! {
          Some(bytes) = writer_recv.recv() => {
            if wr
              .write(&(bytes.len() as u32).to_be_bytes())
              .await
              .is_ok()
            {
              _ = wr.write_all(&bytes[..]).await;
            } else {
              break;
            }

          },

          _ = &mut stop_rx => {
            println!("handle_writer received stop signal.");
            break;
          }
        }
    }

    _ = send_tx.send(());
}

// async fn handle_result(result: HandleResult, sender: &Sender<SendMessage>, uid: u64, is_ws: bool) {
//     let HandleResult {
//         mut owns,
//         mut rpcs,
//         mut groups,
//         mut networks,
//     } = result;

//     loop {
//         if !rpcs.is_empty() {
//             let msg = rpcs.remove(0);
//             sender
//                 .send(SendMessage::Rpc(uid, msg, is_ws))
//                 .await
//                 .expect("TDN channel closed");
//         } else {
//             break;
//         }
//     }

//     loop {
//         if !owns.is_empty() {
//             let msg = owns.remove(0);
//             sender
//                 .send(SendMessage::Own(msg))
//                 .await
//                 .expect("TDN channel closed");
//         } else {
//             break;
//         }
//     }

//     loop {
//         if !groups.is_empty() {
//             let (gid, msg) = groups.remove(0);
//             sender
//                 .send(SendMessage::Group(gid, msg))
//                 .await
//                 .expect("TDN channel closed");
//         } else {
//             break;
//         }
//     }

//     // must last send, because it will has stop type.
//     loop {
//         if !networks.is_empty() {
//             let msg = networks.remove(0);
//             sender
//                 .send(SendMessage::Network(msg))
//                 .await
//                 .expect("TDN channel closed");
//         } else {
//             break;
//         }
//     }
// }

struct Ledger {
    consumer_host_service: (PeerId, bool),
    telemetries: Vec<(PeerId, bool)>,
    groups: HashMap<u64, (String, Vec<PeerId>)>,
}

struct State(Arc<RwLock<Ledger>>);

// fn rpc_handler(ledger: Arc<RwLock<Ledger>>) -> RpcHandler<State> {
//     let mut rpc_handler = RpcHandler::new(State(ledger));

//     rpc_handler.add_method("say_hello", |_gid: GroupId, _params, _state| async move {
//         Ok(HandleResult::rpc(json!("hello")))
//     });

//     rpc_handler.add_method("p2p-stop", |_gid, _params, _state| async move {
//         Ok(HandleResult::network(NetworkType::NetworkStop))
//     });

//     rpc_handler.add_method(
//         "p2p-stable",
//         |_gid, _params, state: Arc<State>| async move {
//             let mut results = HandleResult::new();

//             // fetch new consumer host service
//             let consumer_host = get_consumer_host_peer().await.unwrap_or(PeerId::default());

//             let mut waitings = vec![];
//             let ledger = state.0.read().await;

//             for i in ledger.telemetries.iter() {
//                 if !i.1 {
//                     waitings.push(i.0);
//                 }
//             }
//             let consumer_connected = ledger.consumer_host_service.1;
//             let old_peer = ledger.consumer_host_service.0;
//             let projects: Vec<String> = ledger
//                 .groups
//                 .iter()
//                 .map(|(_, (p, _))| p.to_owned())
//                 .collect();
//             drop(ledger);

//             if !consumer_connected {
//                 if consumer_host != PeerId::default() {
//                     waitings.push(consumer_host);
//                     if consumer_host != old_peer {
//                         let mut ledger = state.0.write().await;
//                         ledger.consumer_host_service.0 = consumer_host;
//                         drop(ledger);
//                     }
//                 }
//             }

//             let self_bytes = bincode::serialize(&JoinData(projects)).unwrap_or(vec![]);
//             for pid in waitings {
//                 let peer = Peer::peer(pid);
//                 results.groups.push((
//                     ROOT_GROUP_ID,
//                     SendType::Connect(0, peer, self_bytes.clone()),
//                 ));
//             }
//             Ok(results)
//         },
//     );

//     rpc_handler.add_method(
//         "project-join",
//         |_gid: GroupId, params: Vec<RpcParam>, state: Arc<State>| async move {
//             if params.len() != 1 {
//                 return Err(RpcError::ParseError);
//             }
//             let project = params[0].as_str().ok_or(RpcError::ParseError)?;
//             let gid = hash_to_group_id(project.as_bytes());

//             let mut results = HandleResult::new();
//             if state.0.read().await.groups.contains_key(&gid) {
//                 return Ok(results);
//             }

//             let mut ledger = state.0.write().await;
//             ledger.groups.insert(gid, (project.to_owned(), vec![]));
//             let (_, root_peers) = ledger.groups.get(&ROOT_GROUP_ID).cloned().unwrap();
//             drop(ledger);

//             // broadcast event in root group
//             results.networks.push(NetworkType::AddGroup(gid));
//             let bytes = Event::ProjectJoin(gid).to_bytes();
//             for peer in root_peers {
//                 results
//                     .groups
//                     .push((ROOT_GROUP_ID, SendType::Event(0, peer, bytes.clone())));
//             }

//             Ok(results)
//         },
//     );

//     rpc_handler.add_method(
//         "project-leave",
//         |gid: GroupId, _params: Vec<RpcParam>, state: Arc<State>| async move {
//             let mut results = HandleResult::new();

//             let mut ledger = state.0.write().await;
//             let peers = ledger.groups.remove(&gid);
//             let _ = ledger.groups.remove(&gid);
//             drop(ledger);

//             if let Some((_, peers)) = peers {
//                 let leave_event = Event::ProjectLeave.to_bytes();
//                 let ledger = state.0.read().await;
//                 for peer in peers {
//                     let mut is_keep = false;
//                     for (_, (_, ps)) in ledger.groups.iter() {
//                         if ps.contains(&peer) {
//                             is_keep = true;
//                             break;
//                         }
//                     }
//                     if is_keep {
//                         results
//                             .groups
//                             .push((gid, SendType::Event(0, peer, leave_event.clone())));
//                     } else {
//                         results.groups.push((gid, SendType::Disconnect(peer)))
//                     }
//                 }
//                 drop(ledger);
//             }

//             Ok(results)
//         },
//     );

//     rpc_handler.add_method(
//         "project-report-metrics",
//         |_, _, state: Arc<State>| async move {
//             let mut results = HandleResult::new();

//             let metrics = get_timer_metrics().await;
//             if !metrics.is_empty() {
//                 let indexer = get_indexer().await;
//                 let indexer_network = format!("{}:{}", indexer, COMMAND.network);
//                 let event = Event::MetricsQueryCount2(indexer_network, metrics).to_bytes();
//                 let ledger = state.0.read().await;
//                 let telemetries: Vec<PeerId> = ledger.telemetries.iter().map(|(v, _)| *v).collect();
//                 drop(ledger);
//                 for peer in telemetries {
//                     results
//                         .groups
//                         .push((ROOT_GROUP_ID, SendType::Event(0, peer, event.clone())));
//                 }
//             }

//             Ok(results)
//         },
//     );

//     rpc_handler.add_method(
//         "project-report-status",
//         |_, _, state: Arc<State>| async move {
//             let mut results = HandleResult::new();

//             let ledger = state.0.read().await;
//             let telemetries: Vec<PeerId> = ledger.telemetries.iter().map(|(v, _)| *v).collect();
//             let project_ids: Vec<String> = ledger
//                 .groups
//                 .iter()
//                 .map(|(_, (id, _))| id.clone())
//                 .collect();
//             drop(ledger);

//             let mut events = vec![];
//             for project_id in project_ids {
//                 if let Ok(project) = get_project(&project_id).await {
//                     if let Ok(data) = project.metadata(MetricsNetwork::P2P).await {
//                         let e = Event::ProjectMetadataRes(
//                             serde_json::to_string(&data).map_err(|_| RpcError::ParseError)?,
//                         );
//                         events.push(e.to_bytes());
//                     }
//                 }
//             }

//             for peer in telemetries {
//                 for event in &events {
//                     results
//                         .groups
//                         .push((ROOT_GROUP_ID, SendType::Event(0, peer, event.clone())));
//                 }
//             }

//             Ok(results)
//         },
//     );

//     rpc_handler.add_method(
//         "payg-report-conflict",
//         |_, params: Vec<RpcParam>, state: Arc<State>| async move {
//             let deployment = params[0].as_str().ok_or(RpcError::ParseError)?.to_owned();
//             let channel = params[1].as_str().ok_or(RpcError::ParseError)?.to_owned();
//             let conflict = params[2].as_i64().ok_or(RpcError::ParseError)? as i32;
//             let start = params[3].as_i64().ok_or(RpcError::ParseError)?;
//             let end = params[4].as_i64().ok_or(RpcError::ParseError)?;

//             let mut results = HandleResult::new();

//             let indexer = get_indexer().await;
//             let event =
//                 Event::MetricsPaygConflict(indexer, deployment, channel, conflict, start, end)
//                     .to_bytes();
//             let ledger = state.0.read().await;
//             let telemetries: Vec<PeerId> = ledger.telemetries.iter().map(|(v, _)| *v).collect();
//             drop(ledger);
//             for peer in telemetries {
//                 results
//                     .groups
//                     .push((ROOT_GROUP_ID, SendType::Event(0, peer, event.clone())));
//             }

//             Ok(results)
//         },
//     );

//     rpc_handler.add_method(
//         "project-broadcast-healthy",
//         |_gid: GroupId, _params: Vec<RpcParam>, state: Arc<State>| async move {
//             let mut results = HandleResult::new();

//             let ledger = state.0.read().await;
//             let groups = ledger.groups.clone();
//             drop(ledger);

//             let healthy = indexer_healthy().await;
//             let data = serde_json::to_string(&healthy).unwrap_or("".to_owned());
//             let event = Event::IndexerHealthy(data).to_bytes();

//             for (gid, (_project, peers)) in groups {
//                 for peer in peers {
//                     results
//                         .groups
//                         .push((gid, SendType::Event(0, peer, event.clone())));
//                 }
//             }

//             Ok(results)
//         },
//     );

//     rpc_handler
// }

// async fn handle_group(
//     gid: GroupId,
//     msg: RecvType,
//     ledger: Arc<RwLock<Ledger>>,
// ) -> Result<HandleResult> {
//     let mut results = HandleResult::new();
//     let project = if let Some((project, _)) = ledger.read().await.groups.get(&gid) {
//         project.to_owned()
//     } else {
//         return Ok(results);
//     };

//     match msg {
//         RecvType::Connect(peer, bytes) => {
//             debug!("Receive project {} peer {} join", gid, peer.id.short_show());
//             let mut is_stable = false;
//             if let Ok(data) = bincode::deserialize::<JoinData>(&bytes) {
//                 let peer_id = peer.id;
//                 let mut ledger = ledger.write().await;
//                 for project in data.0 {
//                     let gid = hash_to_group_id(project.as_bytes());
//                     if let Some((_, peers)) = ledger.groups.get_mut(&gid) {
//                         vec_check_push(peers, peer_id);
//                         is_stable = true;
//                     }
//                 }
//                 if ledger.consumer_host_service.0 == peer_id {
//                     ledger.consumer_host_service.1 = true;
//                     is_stable = true;
//                 }
//                 for (p, is) in ledger.telemetries.iter_mut() {
//                     if *p == peer_id {
//                         *is = true;
//                         is_stable = true;
//                     }
//                 }
//                 drop(ledger);
//             }

//             let projects: Vec<String> = ledger
//                 .read()
//                 .await
//                 .groups
//                 .iter()
//                 .map(|(_, (p, _))| p.to_owned())
//                 .collect();
//             let self_bytes = bincode::serialize(&JoinData(projects)).unwrap_or(vec![]);
//             let msg = SendType::Result(0, peer, is_stable, false, self_bytes);
//             results.groups.push((gid, msg));
//         }
//         RecvType::Result(peer, is_ok, bytes) => {
//             debug!(
//                 "Receive project {} peer {} join result: {}",
//                 gid,
//                 peer.id.short_show(),
//                 is_ok
//             );
//             if let Ok(data) = bincode::deserialize::<JoinData>(&bytes) {
//                 let peer_id = peer.id;
//                 let mut ledger = ledger.write().await;
//                 for project in data.0 {
//                     let gid = hash_to_group_id(project.as_bytes());
//                     if let Some((_, peers)) = ledger.groups.get_mut(&gid) {
//                         vec_check_push(peers, peer_id);
//                     }
//                 }
//                 if ledger.consumer_host_service.0 == peer_id {
//                     ledger.consumer_host_service.1 = true;
//                 }
//                 for (p, is) in ledger.telemetries.iter_mut() {
//                     if *p == peer_id {
//                         *is = true;
//                     }
//                 }
//                 drop(ledger);
//             }
//         }
//         RecvType::Leave(peer) => {
//             let mut ledger = ledger.write().await;
//             if ledger.consumer_host_service.0 == peer.id {
//                 ledger.consumer_host_service.1 = false;
//             }
//             for (p, is) in ledger.telemetries.iter_mut() {
//                 if *p == peer.id {
//                     *is = false;
//                 }
//             }
//             drop(ledger);
//         }
//         RecvType::Event(peer_id, data) => {
//             debug!(
//                 "Receive project {} event from {}",
//                 gid,
//                 peer_id.short_show()
//             );
//             let event = Event::from_bytes(&data)?;
//             handle_event(event, ledger, peer_id, &mut results, gid, project).await?;
//         }
//         _ => {}
//     }

//     Ok(results)
// }

// async fn handle_event(
//     event: Event,
//     ledger: Arc<RwLock<Ledger>>,
//     peer_id: PeerId,
//     results: &mut HandleResult,
//     gid: GroupId,
//     project: String,
// ) -> Result<()> {
//     match event {
//         Event::ProjectJoin(gid) => {
//             let mut ledger = ledger.write().await;
//             if let Some((_, peers)) = ledger.groups.get_mut(&gid) {
//                 vec_check_push(peers, peer_id);
//                 let e = Event::ProjectJoinRes;
//                 let msg = SendType::Event(0, peer_id, e.to_bytes());
//                 results.groups.push((gid, msg));
//             }
//             drop(ledger);
//         }
//         Event::ProjectJoinRes => {
//             let mut ledger = ledger.write().await;
//             if let Some((_, peers)) = ledger.groups.get_mut(&gid) {
//                 vec_check_push(peers, peer_id);
//             }
//             drop(ledger);
//         }
//         Event::ProjectLeave => {
//             // update ledger
//             let mut ledger = ledger.write().await;
//             if let Some((_, peers)) = ledger.groups.get_mut(&gid) {
//                 vec_remove_item(peers, &peer_id);
//             }
//             drop(ledger);
//         }
//         Event::ProjectMetadata(project, _block) => {
//             if let Ok(project) = get_project(&project).await {
//                 if let Ok(data) = project.metadata(MetricsNetwork::P2P).await {
//                     let e = Event::ProjectMetadataRes(serde_json::to_string(&data)?);

//                     let msg = SendType::Event(0, peer_id, e.to_bytes());
//                     results.groups.push((gid, msg));
//                 }
//             }
//         }
//         Event::PaygPrice(project) => {
//             if let Ok(data) = merket_price(project).await {
//                 let e = Event::PaygPriceRes(serde_json::to_string(&data)?);

//                 let msg = SendType::Event(0, peer_id, e.to_bytes());
//                 results.groups.push((gid, msg));
//             }
//         }
//         Event::PaygOpen(uid, state) => {
//             let res = match open_state(&serde_json::from_str(&state)?).await {
//                 Ok(state) => state,
//                 Err(err) => err.to_json(),
//             };
//             let e = Event::PaygOpenRes(uid, serde_json::to_string(&res)?);
//             let msg = SendType::Event(0, peer_id, e.to_bytes());
//             results.groups.push((gid, msg));
//         }
//         Event::PaygQuery(uid, query, ep_name, state) => {
//             let state: RpcParam = serde_json::from_str(&state)?;
//             if let Ok(state) = QueryState::from_json(&state) {
//                 let ep_name = ep_name.unwrap_or("default".to_owned());
//                 if let Ok(p) = get_project(&project).await {
//                     if let Ok(endpoint) = p.endpoint(&ep_name, true) {
//                         let result = match query_single_state(
//                             &project,
//                             query,
//                             endpoint.endpoint.clone(),
//                             state,
//                             MetricsNetwork::P2P,
//                             false,
//                         )
//                         .await
//                         {
//                             Ok((res_query, res_signature, res_state, _limit)) => {
//                                 json!({
//                                     "result": general_purpose::STANDARD.encode(&res_query),
//                                     "signature": res_signature,
//                                     "state": res_state,
//                                 })
//                             }
//                             Err(err) => json!({ "error": format!("{:?}", err) }),
//                         };

//                         let e = Event::PaygQueryRes(uid, serde_json::to_string(&result)?);
//                         let msg = SendType::Event(0, peer_id, e.to_bytes());
//                         results.groups.push((gid, msg));
//                     }
//                 }
//             }
//         }
//         Event::CloseAgreementLimit(uid, agreement) => {
//             let res = match handle_close_agreement_limit(&peer_id.to_hex(), &agreement).await {
//                 Ok(data) => data,
//                 Err(err) => err.to_json(),
//             };

//             let e = Event::CloseAgreementLimitRes(uid, serde_json::to_string(&res)?);
//             let msg = SendType::Event(0, peer_id, e.to_bytes());
//             results.groups.push((gid, msg));
//         }
//         Event::CloseAgreementQuery(uid, agreement, query, ep_name) => {
//             let res = match handle_close_agreement_query(
//                 &peer_id.to_hex(),
//                 &agreement,
//                 &project,
//                 query,
//                 ep_name,
//             )
//             .await
//             {
//                 Ok(data) => data,
//                 Err(err) => serde_json::to_string(&err.to_json()).unwrap_or("".to_owned()),
//             };

//             let e = Event::CloseAgreementQueryRes(uid, res);
//             let msg = SendType::Event(0, peer_id, e.to_bytes());
//             results.groups.push((gid, msg));
//         }
//         _ => {
//             debug!("Not handle event: {:?}", event);
//         }
//     }
//     Ok(())
// }

async fn handle_new_event(
    event: Event,
    ledger: Arc<RwLock<Ledger>>,
    peer_id: PeerId,
    results: &mut Vec<Vec<u8>>,
    gid: u64,
    project: String,
) -> Result<()> {
    match event {
        Event::ProjectJoin(gid) => {
            let mut ledger = ledger.write().await;
            if let Some((_, peers)) = ledger.groups.get_mut(&gid) {
                vec_check_push(peers, peer_id);
                let e = Event::ProjectJoinRes;
                let group_event = GroupEvent {
                    group_id: gid,
                    peer_id,
                    event: e,
                };
                let response_json = serde_json::to_string(&group_event)?;
                results.push((*response_json.as_bytes()).to_vec());
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
        Event::ProjectMetadata(project, _block) => {
            if let Ok(project) = get_project(&project).await {
                if let Ok(data) = project.metadata(MetricsNetwork::P2P).await {
                    let e = Event::ProjectMetadataRes(serde_json::to_string(&data)?);
                    let group_event = GroupEvent {
                        group_id: gid,
                        peer_id,
                        event: e,
                    };
                    let response_json = serde_json::to_string(&group_event)?;
                    results.push((*response_json.as_bytes()).to_vec());
                }
            }
        }
        Event::PaygPrice(project) => {
            if let Ok(data) = merket_price(project).await {
                let e = Event::PaygPriceRes(serde_json::to_string(&data)?);
                let group_event = GroupEvent {
                    group_id: gid,
                    peer_id,
                    event: e,
                };
                let response_json = serde_json::to_string(&group_event)?;
                results.push((*response_json.as_bytes()).to_vec());
            }
        }
        Event::PaygOpen(uid, state) => {
            let res = match open_state(&serde_json::from_str(&state)?).await {
                Ok(state) => state,
                Err(err) => err.to_json(),
            };
            let e = Event::PaygOpenRes(uid, serde_json::to_string(&res)?);
            let group_event = GroupEvent {
                group_id: gid,
                peer_id,
                event: e,
            };
            let response_json = serde_json::to_string(&group_event)?;
            results.push((*response_json.as_bytes()).to_vec());
        }
        Event::PaygQuery(uid, query, ep_name, state) => {
            let state = serde_json::from_str(&state)?;
            if let Ok(state) = QueryState::from_json(&state) {
                let ep_name = ep_name.unwrap_or("default".to_owned());
                if let Ok(p) = get_project(&project).await {
                    if let Ok(endpoint) = p.endpoint(&ep_name, true) {
                        let result = match query_single_state(
                            &project,
                            query,
                            endpoint.endpoint.clone(),
                            state,
                            MetricsNetwork::P2P,
                            false,
                        )
                        .await
                        {
                            Ok((res_query, res_signature, res_state, _limit)) => {
                                json!({
                                    "result": general_purpose::STANDARD.encode(&res_query),
                                    "signature": res_signature,
                                    "state": res_state,
                                })
                            }
                            Err(err) => json!({ "error": format!("{:?}", err) }),
                        };

                        let e = Event::PaygQueryRes(uid, serde_json::to_string(&result)?);
                        let group_event = GroupEvent {
                            group_id: gid,
                            peer_id,
                            event: e,
                        };
                        let response_json = serde_json::to_string(&group_event)?;
                        results.push((*response_json.as_bytes()).to_vec());
                    }
                }
            }
        }
        Event::CloseAgreementLimit(uid, agreement) => {
            let res = match handle_close_agreement_limit(&peer_id.to_base58(), &agreement).await {
                Ok(data) => data,
                Err(err) => err.to_json(),
            };

            let e = Event::CloseAgreementLimitRes(uid, serde_json::to_string(&res)?);
            let group_event = GroupEvent {
                group_id: gid,
                peer_id,
                event: e,
            };
            let response_json = serde_json::to_string(&group_event)?;
            results.push((*response_json.as_bytes()).to_vec());
        }
        Event::CloseAgreementQuery(uid, agreement, query, ep_name) => {
            let res = match handle_close_agreement_query(
                &peer_id.to_base58(),
                &agreement,
                &project,
                query,
                ep_name,
            )
            .await
            {
                Ok(data) => data,
                Err(err) => serde_json::to_string(&err.to_json()).unwrap_or("".to_owned()),
            };

            let e = Event::CloseAgreementQueryRes(uid, res);
            let group_event = GroupEvent {
                group_id: gid,
                peer_id,
                event: e,
            };
            let response_json = serde_json::to_string(&group_event)?;
            results.push((*response_json.as_bytes()).to_vec());
        }
        _ => {
            debug!("Not handle event: {:?}", event);
        }
    }
    Ok(())
}

// async fn bootstrap(sender: &Sender<SendMessage>) {
//     for seed in COMMAND.bootstrap() {
//         let p2p = ChamomilePeer::from_multiaddr_string(&seed).unwrap();
//         let peer = Peer::from(p2p);

//         sender
//             .send(SendMessage::Network(NetworkType::Connect(peer)))
//             .await
//             .expect("TDN channel closed");
//     }
// }

async fn handle_close_agreement_limit(
    signer: &str,
    agreement: &str,
) -> std::result::Result<Value, Error> {
    let (daily_limit, daily_used, rate_limit, rate_used) =
        check_and_get_agreement_limit(signer, &agreement).await?;

    Ok(json!({
        "daily_limit": daily_limit,
        "daily_used": daily_used,
        "rate_limit": rate_limit,
        "rate_used": rate_used,
    }))
}

async fn handle_close_agreement_query(
    signer: &str,
    agreement: &str,
    project: &str,
    query: String,
    ep_name: Option<String>,
) -> std::result::Result<String, Error> {
    let ep_name = ep_name.unwrap_or("default".to_owned());
    check_and_save_agreement(signer, &agreement).await?;

    let project = get_project(project).await?;
    let endpoint = project.endpoint(&ep_name, true)?;
    let (data, _signature, _limit) = project
        .check_query(
            query,
            endpoint.endpoint.clone(),
            MetricsQuery::CloseAgreement,
            MetricsNetwork::P2P,
            false,
            false,
            None,
        )
        .await?;
    Ok(hex::encode(data))
}

fn get_ipfs_path() -> Box<Path> {
    env::var("IPFS_PATH")
        .map(|ipfs_path| Path::new(&ipfs_path).into())
        .unwrap_or_else(|_| {
            env::var("HOME")
                .map(|home| Path::new(&home).join(".ipfs"))
                .expect("could not determine home directory")
                .into()
        })
}

/// Read the pre shared key file from the given ipfs directory
fn get_psk(path: &Path) -> std::io::Result<Option<String>> {
    let swarm_key_file = path.join("swarm.key");
    match fs::read_to_string(swarm_key_file) {
        Ok(text) => Ok(Some(text)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e),
    }
}
