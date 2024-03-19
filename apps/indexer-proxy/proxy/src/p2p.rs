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
use chamomile_types::Peer as ChamomilePeer;
use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::io::Result;
use std::path::PathBuf;
use std::sync::Arc;
use subql_indexer_utils::{
    error::Error,
    p2p::{Event, JoinData, ROOT_GROUP_ID, ROOT_NAME},
};
use tdn::{
    prelude::{
        channel_rpc_channel, start_with_config_and_key, ChannelRpcSender, Config, GroupId,
        HandleResult, NetworkType, Peer, PeerId, PeerKey, ReceiveMessage, RecvType, SendMessage,
        SendType,
    },
    types::{
        group::hash_to_group_id,
        primitives::{vec_check_push, vec_remove_item},
        rpc::{json, rpc_request, RpcError, RpcHandler, RpcParam},
    },
};
use tokio::sync::{mpsc::Sender, RwLock};

use crate::{
    account::{get_indexer, indexer_healthy},
    auth::{check_and_get_agreement_limit, check_and_save_agreement},
    cli::COMMAND,
    contracts::get_consumer_host_peer,
    metrics::{get_timer_metrics, MetricsNetwork, MetricsQuery},
    payg::{merket_price, open_state, query_state},
    primitives::*,
    project::get_project,
};

pub static P2P_SENDER: Lazy<RwLock<Vec<ChannelRpcSender>>> = Lazy::new(|| RwLock::new(vec![]));

pub async fn send(method: &str, params: Vec<RpcParam>, gid: GroupId) {
    let senders = P2P_SENDER.read().await;
    if !senders.is_empty() {
        senders[0].send(rpc_request(0, method, params, gid)).await;
    }
}

pub async fn stop_network() {
    let senders = P2P_SENDER.read().await;
    if senders.is_empty() {
        info!("NONE NETWORK, NOT STOP");
    } else {
        debug!("RESTART NEW P2P NETWORK");
        senders[0].send(rpc_request(0, "p2p-stop", vec![], 0)).await;
        drop(senders);
        tokio::time::sleep(std::time::Duration::from_secs(P2P_RESTART_TIME)).await;
    }
}

pub async fn report_conflict(
    deployment: String,
    channel: String,
    conflict: i32,
    start: i64,
    end: i64,
) {
    let senders = P2P_SENDER.read().await;
    if senders.is_empty() {
        warn!("NONE NETWORK WHEN REPORT CONFLICT");
    } else {
        senders[0]
            .send(rpc_request(
                0,
                "payg-report-conflict",
                vec![
                    deployment.into(),
                    channel.into(),
                    conflict.into(),
                    start.into(),
                    end.into(),
                ],
                0,
            ))
            .await;
        drop(senders);
    }
}

async fn check_stable() {
    loop {
        tokio::time::sleep(std::time::Duration::from_secs(P2P_STABLE_TIME)).await;
        let senders = P2P_SENDER.read().await;
        if senders.is_empty() {
            drop(senders);
            continue;
        } else {
            debug!("Check stable connections");
            senders[0]
                .send(rpc_request(0, "p2p-stable", vec![], 0))
                .await;
        }
        drop(senders);
    }
}

async fn report_metrics() {
    loop {
        tokio::time::sleep(std::time::Duration::from_secs(P2P_METRICS_TIME)).await;
        let senders = P2P_SENDER.read().await;
        if senders.is_empty() {
            drop(senders);
            continue;
        } else {
            debug!("Report projects metrics");
            senders[0]
                .send(rpc_request(0, "project-report-metrics", vec![], 0))
                .await;
        }
        drop(senders);
    }
}

async fn report_status() {
    loop {
        tokio::time::sleep(std::time::Duration::from_secs(P2P_METRICS_STATUS_TIME)).await;
        let senders = P2P_SENDER.read().await;
        if senders.is_empty() {
            drop(senders);
            continue;
        } else {
            debug!("Report projects status");
            senders[0]
                .send(rpc_request(0, "project-report-status", vec![], 0))
                .await;
        }
        drop(senders);
    }
}

async fn broadcast_healthy() {
    loop {
        tokio::time::sleep(std::time::Duration::from_secs(P2P_BROADCAST_HEALTHY_TIME)).await;
        let senders = P2P_SENDER.read().await;
        if senders.is_empty() {
            drop(senders);
            continue;
        } else {
            debug!("Report projects healthy");
            senders[0]
                .send(rpc_request(0, "project-broadcast-healthy", vec![], 0))
                .await;
        }
        drop(senders);
    }
}

pub fn listen() {
    tokio::spawn(report_metrics());
    tokio::spawn(report_status());
    tokio::spawn(check_stable());
    tokio::spawn(broadcast_healthy());
}

pub async fn start_network(key: PeerKey) {
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
            warn!("GOT NOT HANDLE RPC: {:?}", msg);
        }
    });

    let mut config = Config::default();
    config.only_stable_data = false;
    config.db_path = Some(PathBuf::from("./.data/p2p"));
    config.rpc_http = None;
    config.p2p_peer = Peer::socket(COMMAND.p2p());
    config.rpc_channel = Some((out_send, inner_recv));
    config.group_ids = vec![ROOT_GROUP_ID];

    let (peer_addr, send, mut out_recv) = start_with_config_and_key(config, key).await.unwrap();
    debug!("Peer id: {:?}", peer_addr);

    let mut init_groups = HashMap::new();
    init_groups.insert(ROOT_GROUP_ID, (ROOT_NAME.to_owned(), vec![]));
    let ledger = Arc::new(RwLock::new(Ledger {
        consumer_host_service: (PeerId::default(), false),
        telemetries: COMMAND.telemetries().iter().map(|v| (*v, false)).collect(),
        groups: init_groups,
    }));
    bootstrap(&send).await;

    let rpc_handler = rpc_handler(ledger.clone());
    while let Some(message) = out_recv.recv().await {
        match message {
            ReceiveMessage::Group(gid, msg) => {
                if let Ok(result) = handle_group(gid, msg, ledger.clone()).await {
                    handle_result(result, &send, 0, true).await;
                }
            }
            ReceiveMessage::Rpc(uid, params, is_ws) => {
                if let Ok(result) = rpc_handler.handle(params).await {
                    handle_result(result, &send, uid, is_ws).await;
                }
            }
            ReceiveMessage::NetworkLost => {
                debug!("No network connections, will re-connect");
                bootstrap(&send).await;
            }
            ReceiveMessage::Own(_) => {
                debug!("Nothing about own");
            }
        }
    }
}

async fn handle_result(result: HandleResult, sender: &Sender<SendMessage>, uid: u64, is_ws: bool) {
    let HandleResult {
        mut owns,
        mut rpcs,
        mut groups,
        mut networks,
    } = result;

    loop {
        if !rpcs.is_empty() {
            let msg = rpcs.remove(0);
            sender
                .send(SendMessage::Rpc(uid, msg, is_ws))
                .await
                .expect("TDN channel closed");
        } else {
            break;
        }
    }

    loop {
        if !owns.is_empty() {
            let msg = owns.remove(0);
            sender
                .send(SendMessage::Own(msg))
                .await
                .expect("TDN channel closed");
        } else {
            break;
        }
    }

    loop {
        if !groups.is_empty() {
            let (gid, msg) = groups.remove(0);
            sender
                .send(SendMessage::Group(gid, msg))
                .await
                .expect("TDN channel closed");
        } else {
            break;
        }
    }

    // must last send, because it will has stop type.
    loop {
        if !networks.is_empty() {
            let msg = networks.remove(0);
            sender
                .send(SendMessage::Network(msg))
                .await
                .expect("TDN channel closed");
        } else {
            break;
        }
    }
}

struct Ledger {
    consumer_host_service: (PeerId, bool),
    telemetries: Vec<(PeerId, bool)>,
    groups: HashMap<GroupId, (String, Vec<PeerId>)>,
}

struct State(Arc<RwLock<Ledger>>);

fn rpc_handler(ledger: Arc<RwLock<Ledger>>) -> RpcHandler<State> {
    let mut rpc_handler = RpcHandler::new(State(ledger));

    rpc_handler.add_method("say_hello", |_gid: GroupId, _params, _state| async move {
        Ok(HandleResult::rpc(json!("hello")))
    });

    rpc_handler.add_method("p2p-stop", |_gid, _params, _state| async move {
        Ok(HandleResult::network(NetworkType::NetworkStop))
    });

    rpc_handler.add_method(
        "p2p-stable",
        |_gid, _params, state: Arc<State>| async move {
            let mut results = HandleResult::new();

            // fetch new consumer host service
            let consumer_host = get_consumer_host_peer().await.unwrap_or(PeerId::default());

            let mut waitings = vec![];
            let ledger = state.0.read().await;

            for i in ledger.telemetries.iter() {
                if !i.1 {
                    waitings.push(i.0);
                }
            }
            let consumer_connected = ledger.consumer_host_service.1;
            let old_peer = ledger.consumer_host_service.0;
            let projects: Vec<String> = ledger
                .groups
                .iter()
                .map(|(_, (p, _))| p.to_owned())
                .collect();
            drop(ledger);

            if !consumer_connected {
                if consumer_host != PeerId::default() {
                    waitings.push(consumer_host);
                    if consumer_host != old_peer {
                        let mut ledger = state.0.write().await;
                        ledger.consumer_host_service.0 = consumer_host;
                        drop(ledger);
                    }
                }
            }

            let self_bytes = bincode::serialize(&JoinData(projects)).unwrap_or(vec![]);
            for pid in waitings {
                let peer = Peer::peer(pid);
                results.groups.push((
                    ROOT_GROUP_ID,
                    SendType::Connect(0, peer, self_bytes.clone()),
                ));
            }
            Ok(results)
        },
    );

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
        "project-leave",
        |gid: GroupId, _params: Vec<RpcParam>, state: Arc<State>| async move {
            let mut results = HandleResult::new();

            let mut ledger = state.0.write().await;
            let peers = ledger.groups.remove(&gid);
            let _ = ledger.groups.remove(&gid);
            drop(ledger);

            if let Some((_, peers)) = peers {
                let leave_event = Event::ProjectLeave.to_bytes();
                let ledger = state.0.read().await;
                for peer in peers {
                    let mut is_keep = false;
                    for (_, (_, ps)) in ledger.groups.iter() {
                        if ps.contains(&peer) {
                            is_keep = true;
                            break;
                        }
                    }
                    if is_keep {
                        results
                            .groups
                            .push((gid, SendType::Event(0, peer, leave_event.clone())));
                    } else {
                        results.groups.push((gid, SendType::Disconnect(peer)))
                    }
                }
                drop(ledger);
            }

            Ok(results)
        },
    );

    rpc_handler.add_method(
        "project-report-metrics",
        |_, _, state: Arc<State>| async move {
            let mut results = HandleResult::new();

            let metrics = get_timer_metrics().await;
            if !metrics.is_empty() {
                let indexer = get_indexer().await;
                let event = Event::MetricsQueryCount(indexer.clone(), metrics).to_bytes();
                let ledger = state.0.read().await;
                let telemetries: Vec<PeerId> = ledger.telemetries.iter().map(|(v, _)| *v).collect();
                drop(ledger);
                for peer in telemetries {
                    results
                        .groups
                        .push((ROOT_GROUP_ID, SendType::Event(0, peer, event.clone())));
                }
            }

            Ok(results)
        },
    );

    rpc_handler.add_method(
        "project-report-status",
        |_, _, state: Arc<State>| async move {
            let mut results = HandleResult::new();

            let ledger = state.0.read().await;
            let telemetries: Vec<PeerId> = ledger.telemetries.iter().map(|(v, _)| *v).collect();
            let project_ids: Vec<String> = ledger
                .groups
                .iter()
                .map(|(_, (id, _))| id.clone())
                .collect();
            drop(ledger);

            let mut events = vec![];
            for project_id in project_ids {
                if let Ok(project) = get_project(&project_id).await {
                    if let Ok(data) = project.metadata(None, MetricsNetwork::P2P).await {
                        let e = Event::ProjectMetadataRes(
                            serde_json::to_string(&data).map_err(|_| RpcError::ParseError)?,
                        );
                        events.push(e.to_bytes());
                    }
                }
            }

            for peer in telemetries {
                for event in &events {
                    results
                        .groups
                        .push((ROOT_GROUP_ID, SendType::Event(0, peer, event.clone())));
                }
            }

            Ok(results)
        },
    );

    rpc_handler.add_method(
        "payg-report-conflict",
        |_, params: Vec<RpcParam>, state: Arc<State>| async move {
            let deployment = params[0].as_str().ok_or(RpcError::ParseError)?.to_owned();
            let channel = params[1].as_str().ok_or(RpcError::ParseError)?.to_owned();
            let conflict = params[2].as_i64().ok_or(RpcError::ParseError)? as i32;
            let start = params[3].as_i64().ok_or(RpcError::ParseError)?;
            let end = params[4].as_i64().ok_or(RpcError::ParseError)?;

            let mut results = HandleResult::new();

            let indexer = get_indexer().await;
            let event =
                Event::MetricsPaygConflict(indexer, deployment, channel, conflict, start, end)
                    .to_bytes();
            let ledger = state.0.read().await;
            let telemetries: Vec<PeerId> = ledger.telemetries.iter().map(|(v, _)| *v).collect();
            drop(ledger);
            for peer in telemetries {
                results
                    .groups
                    .push((ROOT_GROUP_ID, SendType::Event(0, peer, event.clone())));
            }

            Ok(results)
        },
    );

    rpc_handler.add_method(
        "project-broadcast-healthy",
        |_gid: GroupId, _params: Vec<RpcParam>, state: Arc<State>| async move {
            let mut results = HandleResult::new();

            let ledger = state.0.read().await;
            let groups = ledger.groups.clone();
            drop(ledger);

            let healthy = indexer_healthy().await;
            let data = serde_json::to_string(&healthy).unwrap_or("".to_owned());
            let event = Event::IndexerHealthy(data).to_bytes();

            for (gid, (_project, peers)) in groups {
                for peer in peers {
                    results
                        .groups
                        .push((gid, SendType::Event(0, peer, event.clone())));
                }
            }

            Ok(results)
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
    let project = if let Some((project, _)) = ledger.read().await.groups.get(&gid) {
        project.to_owned()
    } else {
        return Ok(results);
    };

    match msg {
        RecvType::Connect(peer, bytes) => {
            debug!("Receive project {} peer {} join", gid, peer.id.short_show());
            let mut is_stable = false;
            if let Ok(data) = bincode::deserialize::<JoinData>(&bytes) {
                let peer_id = peer.id;
                let mut ledger = ledger.write().await;
                for project in data.0 {
                    let gid = hash_to_group_id(project.as_bytes());
                    if let Some((_, peers)) = ledger.groups.get_mut(&gid) {
                        vec_check_push(peers, peer_id);
                        is_stable = true;
                    }
                }
                if ledger.consumer_host_service.0 == peer_id {
                    ledger.consumer_host_service.1 = true;
                    is_stable = true;
                }
                for (p, is) in ledger.telemetries.iter_mut() {
                    if *p == peer_id {
                        *is = true;
                        is_stable = true;
                    }
                }
                drop(ledger);
            }

            let projects: Vec<String> = ledger
                .read()
                .await
                .groups
                .iter()
                .map(|(_, (p, _))| p.to_owned())
                .collect();
            let self_bytes = bincode::serialize(&JoinData(projects)).unwrap_or(vec![]);
            let msg = SendType::Result(0, peer, is_stable, false, self_bytes);
            results.groups.push((gid, msg));
        }
        RecvType::Result(peer, is_ok, bytes) => {
            debug!(
                "Receive project {} peer {} join result: {}",
                gid,
                peer.id.short_show(),
                is_ok
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
                if ledger.consumer_host_service.0 == peer_id {
                    ledger.consumer_host_service.1 = true;
                }
                for (p, is) in ledger.telemetries.iter_mut() {
                    if *p == peer_id {
                        *is = true;
                    }
                }
                drop(ledger);
            }
        }
        RecvType::Leave(peer) => {
            let mut ledger = ledger.write().await;
            if ledger.consumer_host_service.0 == peer.id {
                ledger.consumer_host_service.1 = false;
            }
            for (p, is) in ledger.telemetries.iter_mut() {
                if *p == peer.id {
                    *is = false;
                }
            }
            drop(ledger);
        }
        RecvType::Event(peer_id, data) => {
            debug!(
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
                Event::ProjectMetadata(project, block) => {
                    if let Ok(project) = get_project(&project).await {
                        if let Ok(data) = project.metadata(block, MetricsNetwork::P2P).await {
                            let e = Event::ProjectMetadataRes(serde_json::to_string(&data)?);

                            let msg = SendType::Event(0, peer_id, e.to_bytes());
                            results.groups.push((gid, msg));
                        }
                    }
                }
                Event::PaygPrice(project) => {
                    if let Ok(data) = merket_price(project).await {
                        let e = Event::PaygPriceRes(serde_json::to_string(&data)?);

                        let msg = SendType::Event(0, peer_id, e.to_bytes());
                        results.groups.push((gid, msg));
                    }
                }
                Event::PaygOpen(uid, state) => {
                    let res = match open_state(&serde_json::from_str(&state)?).await {
                        Ok(state) => state,
                        Err(err) => err.to_json(),
                    };
                    let e = Event::PaygOpenRes(uid, serde_json::to_string(&res)?);
                    let msg = SendType::Event(0, peer_id, e.to_bytes());
                    results.groups.push((gid, msg));
                }
                Event::PaygQuery(uid, query, ep_name, state) => {
                    let state: RpcParam = serde_json::from_str(&state)?;
                    let result =
                        match query_state(&project, query, ep_name, &state, MetricsNetwork::P2P)
                            .await
                        {
                            Ok((res_query, res_signature, res_state)) => {
                                json!({
                                    "result": general_purpose::STANDARD.encode(&res_query),
                                    "signature": res_signature,
                                    "state": res_state,
                                })
                            }
                            Err(err) => json!({ "error": format!("{:?}", err) }),
                        };

                    let e = Event::PaygQueryRes(uid, serde_json::to_string(&result)?);
                    let msg = SendType::Event(0, peer_id, e.to_bytes());
                    results.groups.push((gid, msg));
                }
                Event::CloseAgreementLimit(uid, agreement) => {
                    let res =
                        match handle_close_agreement_limit(&peer_id.to_hex(), &agreement).await {
                            Ok(data) => data,
                            Err(err) => err.to_json(),
                        };

                    let e = Event::CloseAgreementLimitRes(uid, serde_json::to_string(&res)?);
                    let msg = SendType::Event(0, peer_id, e.to_bytes());
                    results.groups.push((gid, msg));
                }
                Event::CloseAgreementQuery(uid, agreement, query, ep_name) => {
                    let res = match handle_close_agreement_query(
                        &peer_id.to_hex(),
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
                    let msg = SendType::Event(0, peer_id, e.to_bytes());
                    results.groups.push((gid, msg));
                }
                _ => {
                    debug!("Not handle event: {:?}", event);
                }
            }
        }
        _ => {}
    }

    Ok(results)
}

async fn bootstrap(sender: &Sender<SendMessage>) {
    for seed in COMMAND.bootstrap() {
        let p2p = ChamomilePeer::from_multiaddr_string(&seed).unwrap();
        let peer = Peer::from(p2p);

        sender
            .send(SendMessage::Network(NetworkType::Connect(peer)))
            .await
            .expect("TDN channel closed");
    }
}

async fn handle_close_agreement_limit(
    signer: &str,
    agreement: &str,
) -> std::result::Result<RpcParam, Error> {
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
    check_and_save_agreement(signer, &agreement).await?;

    let (data, _signature) = get_project(project)
        .await?
        .query(
            query,
            ep_name,
            MetricsQuery::CloseAgreement,
            MetricsNetwork::P2P,
            false,
        )
        .await?;
    Ok(hex::encode(data))
}
