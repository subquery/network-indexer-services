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

use either::Either;
use libp2p::{
    core::transport::upgrade::Version,
    gossipsub::{self, Behaviour as GossipsubBehavior},
    identify::{Behaviour as IdentifyBehavior, Config as IdentifyConfig},
    identity::Keypair,
    kad::{
        store::MemoryStore as KadInMemory, Behaviour as KadBehavior, Config as KadConfig,
        RoutingUpdate,
    },
    mdns,
    mdns::tokio::Behaviour as MdnsBehavior,
    noise::Config as NoiseConfig,
    pnet::{PnetConfig, PreSharedKey},
    request_response::{
        cbor::Behaviour as RequestResponseBehavior, Config as RequestResponseConfig,
        OutboundRequestId, ProtocolSupport as RequestResponseProtocolSupport,
        ResponseChannel as RequestResponseChannel,
    },
    swarm::NetworkBehaviour,
    tcp,
    yamux::Config as YamuxConfig,
    Multiaddr, PeerId, StreamProtocol, Swarm, SwarmBuilder, Transport,
};
use libp2p_stream::Behaviour as StreamBehavior;
use serde::{Deserialize, Serialize};
use std::{error::Error, time::Duration};
/// "SubQuery" hash to group id as root group id.
pub const ROOT_GROUP_ID: u64 = 12408845626691334533;

/// Root name for projects
pub const ROOT_NAME: &str = "SubQuery";

#[derive(Debug, Serialize, Deserialize)]
pub struct GreeRequest {
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GreetResponse {
    pub message: String,
}

#[derive(NetworkBehaviour)]
pub struct AgentBehavior {
    pub identify: IdentifyBehavior,
    pub kad: KadBehavior<KadInMemory>,
    pub rr: RequestResponseBehavior<GreeRequest, GreetResponse>,
    pub gossipsub: GossipsubBehavior,
    pub mdns: MdnsBehavior,
    pub stream: StreamBehavior,
}

impl AgentBehavior {
    pub fn new(
        kad: KadBehavior<KadInMemory>,
        identify: IdentifyBehavior,
        rr: RequestResponseBehavior<GreeRequest, GreetResponse>,
        gossipsub: GossipsubBehavior,
        mdns: MdnsBehavior,
        stream: StreamBehavior,
    ) -> Self {
        Self {
            kad,
            identify,
            rr,
            gossipsub,
            mdns,
            stream,
        }
    }

    pub fn register_addr_kad(&mut self, peer_id: &PeerId, addr: Multiaddr) -> RoutingUpdate {
        self.kad.add_address(peer_id, addr)
    }

    pub fn send_message(&mut self, peer_id: &PeerId, message: GreeRequest) -> OutboundRequestId {
        self.rr.send_request(peer_id, message)
    }

    pub fn send_response(
        &mut self,
        ch: RequestResponseChannel<GreetResponse>,
        rs: GreetResponse,
    ) -> Result<(), GreetResponse> {
        self.rr.send_response(ch, rs)
    }

    pub fn set_server_mode(&mut self) {
        self.kad.set_mode(Some(libp2p::kad::Mode::Server))
    }
}

pub fn generate_swarm(
    local_key: Keypair,
    psk: Option<PreSharedKey>,
) -> Result<Swarm<AgentBehavior>, Box<dyn Error>> {
    Ok(SwarmBuilder::with_existing_identity(local_key)
        .with_tokio()
        .with_tcp(
            tcp::Config::default().nodelay(true),
            NoiseConfig::new,
            YamuxConfig::default,
        )?
        .with_quic()
        .with_other_transport(|k| {
            let base_transport = tcp::tokio::Transport::new(tcp::Config::default().nodelay(true));
            let maybe_encrypted = match psk {
                Some(psk) => Either::Left(
                    base_transport
                        .and_then(move |socket, _| PnetConfig::new(psk).handshake(socket)),
                ),
                None => Either::Right(base_transport),
            };
            maybe_encrypted
                .upgrade(Version::V1Lazy)
                .authenticate(NoiseConfig::new(k).unwrap())
                .multiplex(YamuxConfig::default())
        })?
        .with_other_transport(|k| {
            let base_transport = tcp::tokio::Transport::new(tcp::Config::default().nodelay(true));
            let maybe_encrypted = match psk {
                Some(psk) => Either::Left(
                    base_transport
                        .and_then(move |socket, _| PnetConfig::new(psk).handshake(socket)),
                ),
                None => Either::Right(base_transport),
            };
            maybe_encrypted
                .upgrade(Version::V1)
                .authenticate(NoiseConfig::new(k).unwrap())
                .multiplex(YamuxConfig::default())
        })?
        .with_behaviour(|key| {
            let local_peer_id = PeerId::from(key.clone().public());
            // info!("LocalPeerID: {local_peer_id}");

            let kad_config = KadConfig::new(StreamProtocol::new("/agent/connection/1.0.0"));

            let kad_memory = KadInMemory::new(local_peer_id);
            let kad = KadBehavior::with_config(local_peer_id, kad_memory, kad_config);

            let identify_config =
                IdentifyConfig::new("/agent/connection/1.0.0".to_string(), key.clone().public())
                    .with_push_listen_addr_updates(true)
                    .with_interval(Duration::from_secs(30));

            let rr_config = RequestResponseConfig::default();
            let rr_protocol = StreamProtocol::new("/agent/message/1.0.0");
            let rr_behavior = RequestResponseBehavior::<GreeRequest, GreetResponse>::new(
                [(rr_protocol, RequestResponseProtocolSupport::Full)],
                rr_config,
            );

            let identify = IdentifyBehavior::new(identify_config);

            let gossipsub_config = gossipsub::ConfigBuilder::default().build().unwrap();
            let gossipsub = gossipsub::Behaviour::new(
                gossipsub::MessageAuthenticity::Signed(key.clone()),
                gossipsub_config,
            )
            .unwrap();

            let mdns = mdns::tokio::Behaviour::new(
                mdns::Config {
                    ttl: Duration::from_secs(5),
                    query_interval: Duration::from_secs(1),
                    ..Default::default()
                },
                key.public().to_peer_id(),
            )
            .unwrap();

            let stream = StreamBehavior::new();

            AgentBehavior::new(kad, identify, rr_behavior, gossipsub, mdns, stream)
        })?
        .with_swarm_config(|cfg| cfg.with_idle_connection_timeout(Duration::from_secs(30)))
        .build())
}

#[derive(Serialize, Deserialize, Debug)]
pub struct JoinData(pub Vec<String>);

#[derive(Serialize, Deserialize, Debug)]
pub struct GroupEvent {
    pub group_id: u64,
    pub peer_id: PeerId,
    pub event: Event,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum Event {
    /// Report project healthy,
    /// params: Json(indexer, controller, version, uptime, os)
    IndexerHealthy(String),
    /// Project join
    ProjectJoin(u64),
    /// Project join response
    ProjectJoinRes,
    /// Project leave
    ProjectLeave,
    /// Request the project poi,
    /// params: project, poi block hash
    ProjectMetadata(String, Option<u64>),
    /// Response project poi
    /// params: project poi
    ProjectMetadataRes(String),
    /// Report indexer services status,
    /// params: project or all
    PaygPrice(Option<String>),
    /// Report indexer services status,
    /// params: payg price/1000 query
    PaygPriceRes(String),
    /// Open the state channel channel,
    /// params: uid, open state
    PaygOpen(u64, String),
    /// Response the channel open,
    /// params: uid, open state
    PaygOpenRes(u64, String),
    /// Query data the by channel,
    /// params: uid, query, ep_name, state
    PaygQuery(u64, String, Option<String>, String),
    /// Response the channel query,
    /// params: uid, data with state
    PaygQueryRes(u64, String),
    /// Query the close agreement limit,
    /// params: uid, agreement id
    CloseAgreementLimit(u64, String),
    /// Response the close agreement limit
    /// params: uid, agreement info
    CloseAgreementLimitRes(u64, String),
    /// Query data by close agreement,
    /// params: uid, agreement, query, ep_name
    CloseAgreementQuery(u64, String, String, Option<String>),
    /// Response the close agreement query,
    /// params: uid, data
    CloseAgreementQueryRes(u64, String),
    /// Report project query log to whitelist use root group id, every 30min, time is ms.
    /// params: indexer, [
    ///   project(String),
    ///   query_total_time(u64),
    ///   query_total_with_time(u64),
    ///   [
    ///     (close_agreement_count_http(u64), close_agreement_count_ws(u64), close_agreement_count_p2p(u64)),
    ///     (payg_count_http(u64), payg_count_ws(u64), payg_count_p2p(u64)),
    ///     (whitelist_http(u64)), whitelitst_ws(u64), whitelist_p2p(u64))
    ///   ],
    /// ]
    MetricsQueryCount(String, Vec<(String, u64, Vec<(u64, u64, u64)>)>),
    /// Report payg conflict info
    /// params: indexer, DeploymentId, channel, total conflict, start time, end time.
    MetricsPaygConflict(String, String, String, i32, i64, i64),
    /// above
    MetricsQueryCount2(String, Vec<(String, u64, u64, Vec<(u64, u64, u64)>)>),
}

impl Event {
    pub fn to_bytes(&self) -> Vec<u8> {
        bincode::serialize(self).unwrap_or(vec![])
    }

    pub fn from_bytes(data: &[u8]) -> std::io::Result<Self> {
        bincode::deserialize(data).map_err(|_| {
            std::io::Error::new(std::io::ErrorKind::Other, "P2P Event deserialize failure")
        })
    }
}
