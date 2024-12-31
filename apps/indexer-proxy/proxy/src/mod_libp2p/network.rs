use crate::mod_libp2p::{
    behavior::{AgentBehavior, AgentEvent},
    message::{AgentMessage, GreetRequest},
};
use futures_util::StreamExt;
use libp2p::{
    gossipsub::Event as GossipsubEvent,
    identify::Event as IdentifyEvent,
    kad::{Event as KademliaEvent, RecordKey},
    mdns::Event as MdnsEvent,
    ping::Event as PingEvent,
    request_response::{Event as RequestResponseEvent, Message, OutboundRequestId},
    swarm::ConnectionId,
    swarm::SwarmEvent,
    PeerId, Swarm,
};
use std::collections::HashMap;
use subql_indexer_utils::constants::METRICS_PEER_ID;
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
        let mut interval = time::interval(Duration::from_secs(600));
        // let mut interval2 = time::interval(Duration::from_secs(10));
        loop {
            tokio::select! {
                event = self.swarm.select_next_some() => self.handle_event(event).await,
                _ = interval.tick() => {
                    if let Some(metrics_peer_id ) = self.metrics_peer_id {
                        let request = GreetRequest {
                            message: format!("Send message from: client: Hello gaess"),
                        };
                        let request_message = AgentMessage::GreetRequest(request);
                        let request_id = self.swarm
                            .behaviour_mut()
                            .send_message(&metrics_peer_id, request_message.clone());
                        self.msg_pool.insert(request_id, "abc".to_string());
                        interval = time::interval(Duration::from_secs(600));
                        interval.reset();
                    }
                }
                // _ = interval2.tick() => {
                //     let key: RecordKey = METRICS_PEER_ID.to_string().into_bytes().into();
                //     let kad_id = self.swarm.behaviour_mut().kad.get_providers(key.clone());
                //     warn!("ask metris peer id here, key is {:?}, kad_id is {:?}", key, kad_id);
                // }
            }
        }
    }

    pub async fn handle_event(&mut self, event: SwarmEvent<AgentEvent>) {
        match event {
            SwarmEvent::ConnectionEstablished {
                peer_id,
                connection_id,
                ..
            } => {
                _ = self.connection_pool.insert(peer_id.clone(), connection_id);
                if peer_id.to_base58() == METRICS_PEER_ID {
                    self.metrics_peer_id = Some(peer_id)
                }
            }
            SwarmEvent::ConnectionClosed { peer_id, .. } => {
                _ = self.connection_pool.remove(&peer_id);
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
                if peer_id.to_base58() == METRICS_PEER_ID {
                    for addr in info.clone().listen_addrs {
                        warn!(" metrics peer found, addr is {:?}", addr);
                        _ = self.swarm.dial(addr);
                    }
                }
            }
            _ => {}
        }
    }

    async fn handle_kad_event(&mut self, event: KademliaEvent) {
        warn!("kad event is {:?}", event);
    }

    async fn handle_request_response_event(
        &mut self,
        event: RequestResponseEvent<AgentMessage, AgentMessage>,
    ) {
        match event {
            RequestResponseEvent::Message { message, .. } => match message {
                Message::Response { request_id, .. } => {
                    self.msg_pool.remove(&request_id);
                }
                _ => {}
            },
            _ => {
                warn!("unhandle request response msg is {:?}", event);
            }
        }
    }

    async fn handle_gossipsub_event(&mut self, event: GossipsubEvent) {}

    async fn handle_ping_event(&mut self, event: PingEvent) {}

    async fn handle_mdns_event(&mut self, event: MdnsEvent) {}
}
