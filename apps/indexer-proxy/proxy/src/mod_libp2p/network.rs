use crate::{
    account::{get_indexer, indexer_healthy},
    metrics::get_timer_metrics,
    mod_libp2p::behavior::{AgentBehavior, AgentEvent},
    primitives::{P2P_BROADCAST_HEALTHY_TIME, P2P_METRICS_STATUS_TIME, P2P_METRICS_TIME},
    COMMAND,
};
use futures_util::StreamExt;
use libp2p::{
    core::ConnectedPoint,
    gossipsub::Event as GossipsubEvent,
    identify::Event as IdentifyEvent,
    kad::{self, Event as KademliaEvent, RecordKey},
    mdns::Event as MdnsEvent,
    ping::Event as PingEvent,
    request_response::{Event as RequestResponseEvent, Message, OutboundRequestId},
    swarm::ConnectionId,
    swarm::SwarmEvent,
    PeerId, Swarm,
};
use std::collections::HashMap;
use subql_indexer_utils::constants::METRICS_PEER_ID;
use subql_indexer_utils::p2p::Event;
use tokio::time::{self, Duration};

pub(crate) struct EventLoop {
    swarm: Swarm<AgentBehavior>,
    connection_pool: HashMap<PeerId, ConnectionId>,
    msg_pool: HashMap<OutboundRequestId, String>,
    metrics_peer_id: Option<PeerId>,
}

impl EventLoop {
    pub fn new(swarm: Swarm<AgentBehavior>) -> Self {
        let connection_pool = HashMap::new();
        let msg_pool = HashMap::new();
        Self {
            swarm,
            connection_pool,
            msg_pool,
            metrics_peer_id: None,
        }
    }

    pub(crate) async fn run(&mut self) {
        let mut interval_project_report_metrics =
            time::interval(Duration::from_secs(P2P_METRICS_TIME));
        // let mut interval_project_report_status = time::interval(Duration::from_secs(P2P_METRICS_STATUS_TIME));
        let mut interval_project_broadcast_healthy =
            time::interval(Duration::from_secs(P2P_BROADCAST_HEALTHY_TIME));
        loop {
            tokio::select! {
                event = self.swarm.select_next_some() => self.handle_event(event).await,
                _ = interval_project_report_metrics.tick() => {
                    // Event::MetricsQueryCount2
                    let indexer = get_indexer().await;
                    let indexer_network = format!("{}:{}", indexer, COMMAND.network);
                    let metrics = get_timer_metrics().await;
                    let message = Event::MetricsQueryCount2(indexer_network, metrics);
                    if let Some(metrics_peer_id) = self.metrics_peer_id {
                        _ = self.swarm.behaviour_mut().rr.send_request(&metrics_peer_id, message);
                    }
                }
                // _ = interval_project_report_status.tick() => {
               //      // Event::ProjectMetadataRes

               // }
                _ = interval_project_broadcast_healthy.tick() => {
                    // Event::IndexerHealthy
                    let healthy = indexer_healthy().await;
                    let data = serde_json::to_string(&healthy).unwrap_or("".to_owned());
                    let message = Event::IndexerHealthy(data);
                    if let Some(metrics_peer_id) = self.metrics_peer_id {
                        _ = self.swarm.behaviour_mut().rr.send_request(&metrics_peer_id, message);
                    }
                }
            }
        }
    }

    pub async fn handle_event(&mut self, event: SwarmEvent<AgentEvent>) {
        warn!("begin event is {:?}", event);
        match event {
            SwarmEvent::ConnectionEstablished {
                peer_id,
                connection_id,
                endpoint,
                ..
            } => {
                _ = self.connection_pool.insert(peer_id.clone(), connection_id);
                if peer_id.to_base58() == METRICS_PEER_ID {
                    self.metrics_peer_id = Some(peer_id)
                }
                match endpoint {
                    ConnectedPoint::Dialer { address, .. } => {
                        _ = self
                            .swarm
                            .behaviour_mut()
                            .kad
                            .add_address(&peer_id, address);
                        self.swarm
                            .behaviour_mut()
                            .kad
                            .set_mode(Some(kad::Mode::Server));
                    }
                    _ => {}
                }
            }
            SwarmEvent::ConnectionClosed { peer_id, .. } => {
                _ = self.connection_pool.remove(&peer_id);
                _ = self.swarm.behaviour_mut().kad.remove_peer(&peer_id);
                if peer_id.to_base58() == METRICS_PEER_ID {
                    self.metrics_peer_id = None
                }
            }
            SwarmEvent::OutgoingConnectionError { connection_id, .. } => {
                self.connection_pool.retain(|k, v| {
                    if *v == connection_id {
                        if k.to_base58() == METRICS_PEER_ID {
                            self.metrics_peer_id = None
                        }
                        false
                    } else {
                        true
                    }
                });
            }
            SwarmEvent::Behaviour(AgentEvent::Identify(sub_event)) => {
                self.handle_identify_event(sub_event).await
            }
            SwarmEvent::Behaviour(AgentEvent::Kad(sub_event)) => {
                self.handle_kad_event(sub_event).await
            }
            SwarmEvent::Behaviour(AgentEvent::RequestResponse(sub_event)) => {
                self.handle_request_response_event(sub_event).await
            }
            SwarmEvent::Behaviour(AgentEvent::Gossipsub(sub_event)) => {
                self.handle_gossipsub_event(sub_event).await
            }
            SwarmEvent::Behaviour(AgentEvent::Ping(sub_event)) => {
                self.handle_ping_event(sub_event).await
            }
            SwarmEvent::Behaviour(AgentEvent::Mdns(sub_event)) => {
                self.handle_mdns_event(sub_event).await
            }
            _ => warn!("not handled event is {:?}", event),
        }
    }

    async fn handle_identify_event(&mut self, event: IdentifyEvent) {
        match event {
            IdentifyEvent::Received { peer_id, info, .. } => {
                warn!(
                    "peer_id.to_base58() : {:?}, METRICS_PEER_ID",
                    peer_id.to_base58(),
                );
                for addr in info.clone().listen_addrs {
                    warn!(" metrics peer found, addr is {:?}", addr);
                    // _ = self.swarm.dial(addr);
                    self.swarm.behaviour_mut().kad.add_address(&peer_id, addr);
                }
            }
            _ => {}
        }
    }

    async fn handle_kad_event(&mut self, event: KademliaEvent) {
        // warn!("kad event is {:?}", event);
        // match event {
        //     KademliaEvent::RoutingUpdated {
        //         peer, addresses, ..
        //     } => {
        //         if peer.to_base58() == METRICS_PEER_ID {
        //             for addr in addresses.iter() {
        //                 warn!(" metrics peer found, addr is {:?}", addr);
        //                 _ = self.swarm.dial(addr.clone());
        //             }
        //         }
        //     }
        //     // KademliaEvent::OutboundQueryProgressed{result, ..} => {
        //     //     match result {
        //     //         GetRecord{} => {},
        //     //         _ => {}
        //     //     }
        //     // },
        //     _ => {}
        // }
    }

    async fn handle_request_response_event(&mut self, event: RequestResponseEvent<Event, Event>) {
        // match event {
        //     RequestResponseEvent::Message { message, .. } => match message {
        //         Message::Response { request_id, .. } => {
        //             self.msg_pool.remove(&request_id);
        //         }
        //         _ => {}
        //     },
        //     _ => {
        //         warn!("unhandle request response msg is {:?}", event);
        //     }
        // }
    }

    async fn handle_gossipsub_event(&mut self, event: GossipsubEvent) {}

    async fn handle_ping_event(&mut self, event: PingEvent) {}

    async fn handle_mdns_event(&mut self, event: MdnsEvent) {}
}
