use libp2p::{
    identify::{Behaviour as IdentifyBehavior, Event as IdentifyEvent},
    kad::{
        store::MemoryStore as KademliaInMemory, Behaviour as KademliaBehavior,
        Event as KademliaEvent,
    },
    ping::{self, Behaviour as PingBehaviour, Event as PingEvent},
    request_response::{json::Behaviour as RequestResponseBehavior, Event as RequestResponseEvent},
    swarm::NetworkBehaviour,
};
use subql_indexer_utils::p2p::Event;

#[derive(NetworkBehaviour)]
#[behaviour(to_swarm = "AgentEvent")]
pub(crate) struct AgentBehavior {
    pub identify: IdentifyBehavior,
    pub kad: KademliaBehavior<KademliaInMemory>,
    pub rr: RequestResponseBehavior<Event, Event>,
    pub ping: ping::Behaviour,
}

impl AgentBehavior {
    pub fn new(
        kad: KademliaBehavior<KademliaInMemory>,
        identify: IdentifyBehavior,
        rr: RequestResponseBehavior<Event, Event>,
        ping: PingBehaviour,
    ) -> Self {
        Self {
            kad,
            identify,
            rr,
            ping,
        }
    }
}

#[derive(Debug)]
pub(crate) enum AgentEvent {
    Identify(IdentifyEvent),
    Kad(KademliaEvent),
    RequestResponse(RequestResponseEvent<Event, Event>),
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

impl From<RequestResponseEvent<Event, Event>> for AgentEvent {
    fn from(value: RequestResponseEvent<Event, Event>) -> Self {
        Self::RequestResponse(value)
    }
}

impl From<PingEvent> for AgentEvent {
    fn from(value: PingEvent) -> Self {
        Self::Ping(value)
    }
}
