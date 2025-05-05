use crate::{
    account::{get_indexer, indexer_healthy},
    cli::COMMAND,
    metrics::get_timer_metrics,
    mod_libp2p::behavior::{AgentBehavior, AgentEvent},
    primitives::{P2P_BROADCAST_HEALTHY_TIME, P2P_METRICS_TIME},
};
use futures_util::StreamExt;
use libp2p::{
    core::ConnectedPoint,
    identify::{Behaviour as IdentifyBehavior, Config as IdentifyConfig, Event as IdentifyEvent},
    identity::Keypair,
    kad::{
        store::MemoryStore as KadInMemory, Behaviour as KadBehavior, Config as KadConfig,
        Event as KademliaEvent,
    },
    multiaddr::Protocol,
    noise,
    ping::{self, Event as PingEvent},
    request_response::{
        json::Behaviour as RequestResponseBehavior, Config as RequestResponseConfig,
        Event as RequestResponseEvent, ProtocolSupport as RequestResponseProtocolSupport,
    },
    swarm::SwarmEvent,
    tls, yamux, Multiaddr, PeerId, StreamProtocol, Swarm,
};
use once_cell::sync::Lazy;
use std::{error::Error, net::ToSocketAddrs, str::FromStr, sync::Arc, time::Duration};
use subql_contracts::Network;
use subql_indexer_utils::{
    constants::{
        METRICS_PEER_ID, PRODUCTION_BOOSTNODE_PEER_ID_LIST, TEST_BOOSTNODE_PEER_ID_LIST,
        TEST_METRICS_PEER_ID,
    },
    p2p::Event,
};
use tokio::{
    sync::{mpsc, Mutex},
    time,
};

static LAZY_STOP_SENDER: Lazy<Arc<Mutex<Option<mpsc::Sender<()>>>>> =
    Lazy::new(|| Arc::new(Mutex::new(None)));

static LAZY_EVENT_SENDER: Lazy<Arc<Mutex<Option<mpsc::Sender<Event>>>>> =
    Lazy::new(|| Arc::new(Mutex::new(None)));

pub(crate) struct EventLoop {
    swarm: Swarm<AgentBehavior>,
    boot_node_peer_id: Option<PeerId>,
    metrics_peer_id: Option<PeerId>,
    metrics_multiaddr: Option<Multiaddr>,
    stop_receiver: mpsc::Receiver<()>,
    event_receiver: mpsc::Receiver<Event>,
}

impl EventLoop {
    pub async fn new(local_key: Keypair) -> Result<Self, Box<dyn Error + Send + Sync>> {
        let swarm = Self::start_swarm(local_key.clone()).await?;

        let (stop_sender, stop_receiver) = mpsc::channel::<()>(1);
        {
            let mut stop_lock = LAZY_STOP_SENDER.lock().await;
            *stop_lock = Some(stop_sender);
        }
        let (event_sender, event_receiver) = mpsc::channel::<Event>(10);
        {
            let mut event_lock = LAZY_EVENT_SENDER.lock().await;
            *event_lock = Some(event_sender);
        }
        Ok(Self {
            swarm,
            boot_node_peer_id: None,
            metrics_peer_id: None,
            metrics_multiaddr: None,
            stop_receiver,
            event_receiver,
        })
    }

    pub async fn start_swarm(
        local_key: Keypair,
    ) -> Result<Swarm<AgentBehavior>, Box<dyn Error + Send + Sync>> {
        let mut swarm = libp2p::SwarmBuilder::with_existing_identity(local_key.clone())
            .with_tokio()
            .with_tcp(
                Default::default(),
                (tls::Config::new, noise::Config::new),
                yamux::Config::default,
            )?
            .with_quic()
            .with_dns()?
            .with_behaviour(|key| {
                let local_peer_id = PeerId::from(key.clone().public());

                let kad_config = KadConfig::new(StreamProtocol::new("/agent/connection/1.0.0"));
                let kad_memory = KadInMemory::new(local_peer_id);
                let kad = KadBehavior::with_config(local_peer_id, kad_memory, kad_config);

                let rr_config =
                    RequestResponseConfig::default().with_max_concurrent_streams(1024 * 1024);
                let rr_protocol = StreamProtocol::new("/agent/message/1.0.0");
                let rr_behavior = RequestResponseBehavior::<Event, Event>::new(
                    [(rr_protocol, RequestResponseProtocolSupport::Outbound)],
                    rr_config,
                );

                let identify_config = IdentifyConfig::new(
                    "/agent/connection/1.0.0".to_string(),
                    key.clone().public(),
                )
                .with_push_listen_addr_updates(true)
                .with_interval(Duration::from_secs(30));
                let identify = IdentifyBehavior::new(identify_config);

                let ping = ping::Behaviour::new(
                    ping::Config::new().with_interval(Duration::from_secs(10)),
                );

                AgentBehavior::new(kad, identify, rr_behavior, ping)
            })?
            .with_swarm_config(|c| c.with_idle_connection_timeout(Duration::from_secs(u64::MAX)))
            .build();

        for listen_addr in COMMAND.p2p() {
            let listen_addr = listen_addr.clone();
            let listen_addr = listen_addr.parse::<Multiaddr>()?;
            swarm.listen_on(listen_addr)?;
        }

        Ok(swarm)
    }

    pub fn parse_legacy_multiaddr(
        multiaddr_str_list: &Vec<String>,
    ) -> Result<Vec<Multiaddr>, Box<dyn Error>> {
        let mut resolved_multiaddrs = vec![];
        for multiaddr_str in multiaddr_str_list {
            if let Ok(multiaddr) = Multiaddr::from_str(multiaddr_str) {
                let mut dns_name = None;
                let mut port = None;
                let mut transport_protocols = Vec::new();

                for protocol in multiaddr.iter() {
                    match protocol {
                        Protocol::Dns4(name) => dns_name = Some(name),
                        Protocol::Tcp(p) | Protocol::Udp(p) => {
                            port = Some(p);
                            transport_protocols.push(protocol.clone());
                        }
                        _ => transport_protocols.push(protocol.clone()),
                    }
                }

                if let (Some(dns_name), Some(port)) = (dns_name, port) {
                    let addr = format!("{}:{}", dns_name, port);
                    if let Ok(resolved) = addr.to_socket_addrs() {
                        for resolved_ip in resolved {
                            let mut resolved_multiaddr = Multiaddr::empty();
                            resolved_multiaddr
                                .push(Protocol::Ip4(resolved_ip.ip().to_string().parse()?));

                            // Append the transport protocol and port
                            for protocol in &transport_protocols {
                                resolved_multiaddr.push(protocol.clone());
                            }

                            resolved_multiaddrs.push(resolved_multiaddr);
                        }
                    }
                }
            }
        }

        if resolved_multiaddrs.is_empty() {
            Err("not a libp2p dns multiaddr".into())
        } else {
            Ok(resolved_multiaddrs)
        }
    }

    pub(crate) async fn run(&mut self) {
        let mut interval_project_report_metrics =
            time::interval(Duration::from_secs(P2P_METRICS_TIME));

        let mut interval_project_broadcast_healthy =
            time::interval(Duration::from_secs(P2P_BROADCAST_HEALTHY_TIME));

        // let mut interval_report_status =
        //     time::interval(Duration::from_secs(P2P_METRICS_STATUS_TIME));

        let mut interval_connect_bootnode = time::interval(Duration::from_secs(120));

        tokio::time::sleep(Duration::from_secs(3)).await;
        self.connect_to_boot_metrics_node().await;

        let mut check_metrics_interval = time::interval(Duration::from_secs(60));
        loop {
            tokio::select! {
                event = self.swarm.select_next_some() => self.handle_event(event).await,
                _ = interval_project_report_metrics.tick() => {
                    if COMMAND.telemetry {
                        let indexer = get_indexer().await;
                        let indexer_network = format!("{}:{}", indexer, COMMAND.network);
                        let metrics = get_timer_metrics().await;
                        let message = Event::MetricsQueryCount2(indexer_network, metrics);
                        if let Some(metrics_peer_id) = self.metrics_peer_id {
                            _ = self.swarm.behaviour_mut().rr.send_request(&metrics_peer_id, message);
                        }
                    }
                }
                _ = interval_project_broadcast_healthy.tick() => {
                    if COMMAND.telemetry {
                        let healthy = indexer_healthy().await;
                        let data = serde_json::to_string(&healthy).unwrap_or("".to_owned());
                        let message = Event::IndexerHealthy(data);
                        if let Some(metrics_peer_id) = self.metrics_peer_id {
                            _ = self.swarm.behaviour_mut().rr.send_request(&metrics_peer_id, message);
                        }
                    }
                }
                _ = interval_connect_bootnode.tick() => {
                    self.connect_boot_node().await;
                }
                // _ = interval_report_status.tick() => {
                //     if let Some(metrics_peer_id) = self.metrics_peer_id {
                //         let map = PROJECTS.lock().await;
                //         for (_k, project) in map.iter() {
                //             if let Ok(data) = project.metadata(MetricsNetwork::P2P).await {
                //                 if let Ok(json_string) = serde_json::to_string(&data){
                //                     let event = Event::ProjectMetadataRes(json_string);
                //                     _ = self.swarm.behaviour_mut().rr.send_request(&metrics_peer_id, event);
                //                 }
                //             }
                //         }
                //         drop(map);
                //     }
                // }
                Some(event) = self.event_receiver.recv() => {
                    if let Some(metrics_peer_id) = self.metrics_peer_id {
                        _ = self.swarm.behaviour_mut().rr.send_request(&metrics_peer_id, event);
                    }
                }
                _ = self.stop_receiver.recv() => {
                    // Stop signal received, gracefully exit the loop
                    warn!("Received stop signal, stopping event loop...");
                    break;
                }
                _ = check_metrics_interval.tick() => {
                    if let Some(metrics_peer_id) = self.metrics_peer_id {
                        if self.swarm.is_connected(&metrics_peer_id) == false {
                            self.metrics_peer_id = None;
                            self.rennect_to_metrics_node().await;
                        }
                    } else {
                        self.rennect_to_metrics_node().await;
                    }
                }
            }
        }
    }

    pub async fn stop() {
        let lock = LAZY_STOP_SENDER.lock().await;
        if let Some(sender) = &*lock {
            // Use `sender` here safely
            warn!("send stop signal...");
            _ = sender.send(()).await;
        }
    }

    pub async fn handle_event(&mut self, event: SwarmEvent<AgentEvent>) {
        match event {
            SwarmEvent::ConnectionEstablished {
                peer_id,
                connection_id,
                endpoint,
                ..
            } => match Self::is_peer_metrics_node(&peer_id).await {
                true => {
                    self.metrics_peer_id = Some(peer_id);
                    if let ConnectedPoint::Dialer { address, .. } = endpoint {
                        self.metrics_multiaddr = Some(address.clone());
                    }
                    if let Some(connected_boot_peer) = self.boot_node_peer_id {
                        _ = self.swarm.disconnect_peer_id(connected_boot_peer);
                        self.boot_node_peer_id = None;
                    }
                }
                _ => match self.metrics_peer_id {
                    None => {
                        if Self::is_peer_bootnode_node(&peer_id).await {
                            self.boot_node_peer_id = Some(peer_id);
                        } else {
                            self.swarm.close_connection(connection_id);
                        }
                    }
                    Some(_metrics_peer_id) => {
                        self.swarm.close_connection(connection_id);
                    }
                },
            },
            SwarmEvent::OutgoingConnectionError {
                connection_id,
                peer_id,
                ..
            } => {
                if let Some(connect_failed_peer_id) = peer_id {
                    if Self::is_peer_metrics_node(&connect_failed_peer_id).await {
                        self.metrics_multiaddr = None;
                    }
                }
                self.swarm.close_connection(connection_id);
            }

            SwarmEvent::ConnectionClosed {
                peer_id,
                num_established,
                ..
            } => {
                if num_established == 0 {
                    if Self::is_peer_metrics_node(&peer_id).await {
                        self.metrics_peer_id = None;
                        self.metrics_multiaddr = None;
                    }

                    if Self::is_peer_bootnode_node(&peer_id).await {
                        self.boot_node_peer_id = None;
                    }
                }
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
            SwarmEvent::Behaviour(AgentEvent::Ping(sub_event)) => {
                self.handle_ping_event(sub_event).await
            }
            _ => {
                //warn!("not handled event is {:?}", event);
            }
        }
    }

    async fn handle_identify_event(&mut self, event: IdentifyEvent) {
        if self.metrics_multiaddr.is_none() {
            if let IdentifyEvent::Received { peer_id, info, .. } = event {
                if self.boot_node_peer_id.is_some() {
                    for addr in info.clone().listen_addrs {
                        self.swarm.behaviour_mut().kad.add_address(&peer_id, addr);
                    }
                }
            }
        }
    }

    async fn handle_kad_event(&mut self, _event: KademliaEvent) {}

    async fn handle_request_response_event(&mut self, _event: RequestResponseEvent<Event, Event>) {}

    async fn handle_ping_event(&mut self, _event: PingEvent) {}

    async fn connect_boot_node(&mut self) {
        if self.metrics_peer_id.is_none() {
            self.connect_to_boot_metrics_node().await;
        }
    }

    async fn connect_to_boot_metrics_node(&mut self) {
        match Self::parse_legacy_multiaddr(&COMMAND.bootstrap()) {
            Ok(node_url_list) => {
                for node_url in node_url_list {
                    _ = self.swarm.dial(node_url);
                }
            }
            Err(e) => {
                warn!("parse boot node error: {:?}", e);
            }
        }
    }

    pub async fn send_p2p_event(event: Event) {
        info!("send event: {:?}", event);
        let lock = LAZY_EVENT_SENDER.lock().await;
        if let Some(event_sender) = &*lock {
            // Use `sender` here safely
            warn!("send stop signal...");
            _ = event_sender.send(event).await;
        }
    }

    pub async fn rennect_to_metrics_node(&mut self) {
        if let Some(metrics_multiaddr) = &self.metrics_multiaddr {
            _ = self.swarm.dial(metrics_multiaddr.clone());
        } else {
            self.connect_to_boot_metrics_node().await;
        }
    }

    pub async fn is_peer_metrics_node(peer_id: &PeerId) -> bool {
        (COMMAND.network() == Network::Mainnet && peer_id.to_base58() == METRICS_PEER_ID)
            || (COMMAND.network() == Network::Testnet
                && peer_id.to_base58() == TEST_METRICS_PEER_ID)
    }

    pub async fn is_peer_bootnode_node(peer_id: &PeerId) -> bool {
        (COMMAND.network() == Network::Mainnet
            && PRODUCTION_BOOSTNODE_PEER_ID_LIST.contains(&peer_id.to_base58().as_str()))
            || (COMMAND.network() == Network::Testnet
                && TEST_BOOSTNODE_PEER_ID_LIST.contains(&peer_id.to_base58().as_str()))
    }
}
