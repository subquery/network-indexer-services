use libp2p::{
    gossipsub::{Behaviour as GossipsubBehavior, Event as GossipsubEvent},
    identify::{Behaviour as IdentifyBehavior, Event as IdentifyEvent},
    kad::{
        store::MemoryStore as KademliaInMemory, Behaviour as KademliaBehavior,
        Event as KademliaEvent, RoutingUpdate,
    },
    ping::{self, Behaviour as PingBehaviour, Event as PingEvent},
    request_response::{
        cbor::Behaviour as RequestResponseBehavior, Event as RequestResponseEvent,
        OutboundRequestId, ResponseChannel as RequestResponseChannel,
    },
    swarm::NetworkBehaviour,
    Multiaddr, PeerId,
};

use crate::mod_libp2p::message::AgentMessage;

#[derive(NetworkBehaviour)]
#[behaviour(to_swarm = "AgentEvent")]
pub(crate) struct AgentBehavior {
    pub identify: IdentifyBehavior,
    pub kad: KademliaBehavior<KademliaInMemory>,
    pub rr: RequestResponseBehavior<Vec<u8>, Vec<u8>>,
    pub gossipsub: GossipsubBehavior,
    pub ping: ping::Behaviour,
}

impl AgentBehavior {
    pub fn new(
        kad: KademliaBehavior<KademliaInMemory>,
        identify: IdentifyBehavior,
        rr: RequestResponseBehavior<Vec<u8>, Vec<u8>>,
        gossipsub: GossipsubBehavior,
        ping: PingBehaviour,
    ) -> Self {
        Self {
            kad,
            identify,
            rr,
            gossipsub,
            ping,
        }
    }

    pub fn register_addr_kad(&mut self, peer_id: &PeerId, addr: Multiaddr) -> RoutingUpdate {
        self.kad.add_address(peer_id, addr)
    }

    pub fn send_message(&mut self, peer_id: &PeerId, message: AgentMessage) -> OutboundRequestId {
        let binary_message = message.to_binary().expect("Failed to serialize message");
        self.rr.send_request(peer_id, binary_message)
    }

    pub fn send_response(
        &mut self,
        ch: RequestResponseChannel<Vec<u8>>,
        rs: AgentMessage,
    ) -> Result<(), Vec<u8>> {
        let binary_response = rs.to_binary().expect("Failed to serialize response");
        self.rr.send_response(ch, binary_response)
    }

    pub fn set_server_mode(&mut self) {
        self.kad.set_mode(Some(libp2p::kad::Mode::Server))
    }
}

#[derive(Debug)]
pub(crate) enum AgentEvent {
    Identify(IdentifyEvent),
    Kad(KademliaEvent),
    RequestResponse(RequestResponseEvent<Vec<u8>, Vec<u8>>),
    Gossipsub(GossipsubEvent),
    Ping(PingEvent),
}

impl From<IdentifyEvent> for AgentEvent {
    fn from(value: IdentifyEvent) -> Self {
        Self::Identify(value)
    }
}

impl From<KademliaEvent> for AgentEvent {
    fn from(value: KademliaEvent) -> Self {
        Self::Kad(value)
    }
}

impl From<RequestResponseEvent<Vec<u8>, Vec<u8>>> for AgentEvent {
    fn from(value: RequestResponseEvent<Vec<u8>, Vec<u8>>) -> Self {
        Self::RequestResponse(value)
    }
}

impl From<GossipsubEvent> for AgentEvent {
    fn from(value: GossipsubEvent) -> Self {
        Self::Gossipsub(value)
    }
}

impl From<PingEvent> for AgentEvent {
    fn from(value: PingEvent) -> Self {
        Self::Ping(value)
    }
}
