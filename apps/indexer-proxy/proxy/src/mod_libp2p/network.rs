use base64::{engine::general_purpose::STANDARD, Engine};
use futures_util::StreamExt;
use libp2p::{
    core::{transport::upgrade::Version, ConnectedPoint},
    dns,
    identify::{Behaviour as IdentifyBehavior, Config as IdentifyConfig, Event as IdentifyEvent},
    identity::Keypair,
    kad::{
        store::MemoryStore as KadInMemory, Behaviour as KadBehavior, Config as KadConfig,
        Event as KademliaEvent,
    },
    multiaddr::Protocol,
    noise,
    ping::{self, Event as PingEvent},
    pnet::{PnetConfig, PreSharedKey},
    request_response::{
        json::Behaviour as RequestResponseBehavior, Config as RequestResponseConfig,
        Event as RequestResponseEvent, ProtocolSupport as RequestResponseProtocolSupport,
    },
    swarm::{ConnectionId, DialError, SwarmEvent},
    tcp, yamux, Multiaddr, PeerId, StreamProtocol, Swarm, Transport,
};
use once_cell::sync::Lazy;
use std::{
    error::Error,
    net::ToSocketAddrs,
    str::FromStr,
    sync::{Arc, Mutex},
    time::Duration,
};
use subql_indexer_utils::{
    constants::{
        BOOTNODE_ADDRESS_LIST, METRICS_DEFAULT_ADDRESS, METRICS_PEER_ID, PRIVATE_NETWORK_KEY,
    },
    p2p::Event,
};
use tokio::{sync::mpsc, time};

static LAZY_STOP_SENDER: Lazy<Arc<Mutex<Option<mpsc::Sender<()>>>>> =
    Lazy::new(|| Arc::new(Mutex::new(None)));

static LAZY_EVENT_SENDER: Lazy<Arc<Mutex<Option<mpsc::Sender<Event>>>>> =
    Lazy::new(|| Arc::new(Mutex::new(None)));

static LAZY_BOOTNODE_METRICS_LIST: Lazy<Vec<&str>> = Lazy::new(|| {
    let mut list = BOOTNODE_ADDRESS_LIST.to_vec();
    list.push(METRICS_DEFAULT_ADDRESS);
    list
});

use crate::{
    account::{get_indexer, indexer_healthy},
    cli::COMMAND,
    metrics::{
        get_timer_metrics,
        // MetricsNetwork
    },
    mod_libp2p::behavior::{AgentBehavior, AgentEvent},
    primitives::{
        P2P_BROADCAST_HEALTHY_TIME,
        // P2P_METRICS_STATUS_TIME,
        P2P_METRICS_TIME,
    },
    // project::PROJECTS,
};

pub(crate) struct EventLoop {
    swarm: Swarm<AgentBehavior>,
    boot_node_connection_id: Option<ConnectionId>,
    boot_node_peer_id: Option<PeerId>,
    metrics_connection_id: Option<ConnectionId>,
    metrics_peer_id: Option<PeerId>,
    metrics_multiaddr: Option<Multiaddr>,
    stop_receiver: mpsc::Receiver<()>,
    event_receiver: mpsc::Receiver<Event>,
}

impl EventLoop {
    pub async fn new(local_key: Keypair) -> Result<Self, Box<dyn Error + Send + Sync>> {
        let swarm = Self::start_swarm(local_key.clone()).await?;

        let (stop_sender, stop_receiver) = mpsc::channel::<()>(1);
        let (event_sender, event_receiver) = mpsc::channel::<Event>(10);
        {
            if let Ok(mut sender_lock) = LAZY_STOP_SENDER.lock() {
                *sender_lock = Some(stop_sender);
            }
        }
        {
            if let Ok(mut event_lock) = LAZY_EVENT_SENDER.lock() {
                *event_lock = Some(event_sender);
            }
        }
        Ok(Self {
            swarm,
            boot_node_connection_id: None,
            boot_node_peer_id: None,
            metrics_connection_id: None,
            metrics_peer_id: None,
            metrics_multiaddr: None,
            stop_receiver,
            event_receiver,
        })
    }

    pub async fn start_swarm(
        local_key: Keypair,
    ) -> Result<Swarm<AgentBehavior>, Box<dyn Error + Send + Sync>> {
        let psk = Self::get_psk();
        let swarm = libp2p::SwarmBuilder::with_existing_identity(local_key.clone())
            .with_tokio()
            .with_other_transport(|key| {
                let noise_config = noise::Config::new(key).unwrap();
                let mut yamux_config = yamux::Config::default();
                yamux_config.set_max_num_streams(1024 * 1024);

                let base_transport =
                    tcp::tokio::Transport::new(tcp::Config::default().ttl(64).nodelay(true));
                let base_transport = dns::tokio::Transport::system(base_transport)
                    .expect("DNS")
                    .boxed();
                let maybe_encrypted = base_transport
                    .and_then(move |socket, _| PnetConfig::new(psk).handshake(socket));
                maybe_encrypted
                    .upgrade(Version::V1Lazy)
                    .authenticate(noise_config)
                    .multiplex(yamux_config)
            })?
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
            .with_swarm_config(|c| c.with_idle_connection_timeout(Duration::from_secs(60)))
            .build();

        Ok(swarm)
    }

    /// Read the pre shared key file from the given ipfs directory
    fn get_psk() -> PreSharedKey {
        let bytes = STANDARD.decode(PRIVATE_NETWORK_KEY).unwrap();
        let key: [u8; 32] = bytes
            .try_into()
            .map_err(|_| "Decoded key must be 32 bytes long")
            .unwrap();
        PreSharedKey::new(key)
    }

    pub fn parse_legacy_multiaddr(
        multiaddr_str_list: &[&str],
    ) -> Result<Vec<Multiaddr>, Box<dyn Error>> {
        let mut url_list = vec![];
        for multiaddr_str in multiaddr_str_list {
            if let Ok(multiaddr) = Multiaddr::from_str(multiaddr_str) {
                let mut dns_name = None;
                let mut port = None;

                for protocol in multiaddr.iter() {
                    match protocol {
                        Protocol::Dns4(name) => dns_name = Some(name),
                        Protocol::Tcp(p) => port = Some(p),
                        _ => {}
                    }
                }

                if let (Some(dns_name), Some(port)) = (dns_name, port) {
                    let addr = format!("{}:{}", dns_name, port);
                    if let Ok(resolved) = addr.to_socket_addrs() {
                        for resolved_ip in resolved {
                            // info!("Resolved IP address: {}", resolved_ip);
                            // Construct a new Multiaddr with the resolved IP
                            if let Ok(resolved_multiaddr) = Multiaddr::from_str(&format!(
                                "/ip4/{}/tcp/{}",
                                resolved_ip.ip(),
                                port
                            )) {
                                url_list.push(resolved_multiaddr);
                            }
                        }
                    }
                }
            }
        }

        if url_list.is_empty() {
            Err("not a libp2p dns multiaddr".into())
        } else {
            Ok(url_list)
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

        loop {
            tokio::select! {
                event = self.swarm.select_next_some() => self.handle_event(event).await,
                _ = interval_project_report_metrics.tick() => {
                    let indexer = get_indexer().await;
                    let indexer_network = format!("{}:{}", indexer, COMMAND.network);
                    let metrics = get_timer_metrics().await;
                    let message = Event::MetricsQueryCount2(indexer_network, metrics);
                    if let Some(metrics_peer_id) = self.metrics_peer_id {
                        _ = self.swarm.behaviour_mut().rr.send_request(&metrics_peer_id, message);
                    }
                }
                _ = interval_project_broadcast_healthy.tick() => {
                    let healthy = indexer_healthy().await;
                    let data = serde_json::to_string(&healthy).unwrap_or("".to_owned());
                    let message = Event::IndexerHealthy(data);
                    if let Some(metrics_peer_id) = self.metrics_peer_id {
                        _ = self.swarm.behaviour_mut().rr.send_request(&metrics_peer_id, message);
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
            }
        }
    }

    pub fn stop() {
        if let Some(sender) = LAZY_STOP_SENDER.lock().unwrap().as_ref() {
            warn!("send stop signal...");
            _ = sender.send(());
        }
    }

    pub async fn handle_event(&mut self, event: SwarmEvent<AgentEvent>) {
        match event {
            SwarmEvent::ConnectionEstablished {
                peer_id,
                connection_id,
                endpoint,
                ..
            } => match endpoint {
                ConnectedPoint::Dialer { address, .. } => match self.metrics_peer_id {
                    None => {
                        if peer_id.to_base58() == METRICS_PEER_ID {
                            if let Some(boot_node_connection_id) = self.boot_node_connection_id {
                                self.swarm.close_connection(boot_node_connection_id);
                            }
                            match self.metrics_connection_id {
                                Some(old_connected_id) => {
                                    if old_connected_id != connection_id {
                                        self.swarm.close_connection(connection_id);
                                    }
                                }
                                None => {
                                    self.metrics_connection_id = Some(connection_id);
                                    self.metrics_peer_id = Some(peer_id);
                                    self.metrics_multiaddr = Some(address.clone());
                                }
                            }
                        }
                        if let Ok(boot_node_url_list) =
                            Self::parse_legacy_multiaddr(&BOOTNODE_ADDRESS_LIST)
                        {
                            if boot_node_url_list.contains(&address) {
                                match self.boot_node_connection_id {
                                    Some(old_connected_id) => {
                                        if old_connected_id != connection_id {
                                            self.swarm.close_connection(connection_id);
                                        }
                                    }
                                    None => {
                                        self.boot_node_connection_id = Some(connection_id);
                                        self.boot_node_peer_id = Some(peer_id);
                                        _ = self
                                            .swarm
                                            .behaviour_mut()
                                            .kad
                                            .add_address(&peer_id, address);
                                    }
                                }
                            }
                        } else {
                            self.swarm.close_connection(connection_id);
                        }
                    }
                    Some(_metrics_peer_id) => {}
                },
                _ => {
                    self.swarm.close_connection(connection_id);
                }
            },
            SwarmEvent::OutgoingConnectionError {
                connection_id,
                error: DialError::Transport(error_list),
                ..
            } => {
                self.swarm.close_connection(connection_id);
                if self.boot_node_connection_id.is_none() {
                    if let Ok(boot_node_url_list) =
                        Self::parse_legacy_multiaddr(&BOOTNODE_ADDRESS_LIST)
                    {
                        let found_boot_address = error_list
                            .iter()
                            .any(|(multiaddr, _)| boot_node_url_list.contains(&multiaddr));

                        if found_boot_address {
                            for boot_node_url in boot_node_url_list {
                                _ = self.swarm.dial(boot_node_url);
                            }
                        }
                    }
                }
            }

            SwarmEvent::ConnectionClosed {
                peer_id,
                connection_id,
                num_established,
                ..
            } => {
                if num_established == 0 {
                    if let Some(metrics_connected_id) = self.metrics_connection_id {
                        if metrics_connected_id == connection_id {
                            self.metrics_connection_id = None;
                            self.metrics_peer_id = None;
                            self.metrics_multiaddr = None;
                            if let Ok(metrics_node_url_list) =
                                Self::parse_legacy_multiaddr(&[METRICS_DEFAULT_ADDRESS])
                            {
                                _ = self.swarm.behaviour_mut().kad.remove_peer(&peer_id);
                                for metrics_node_url in metrics_node_url_list {
                                    _ = self.swarm.dial(metrics_node_url);
                                }
                            }
                        }
                    }

                    if let Some(boot_node_connected_id) = self.boot_node_connection_id {
                        if boot_node_connected_id == connection_id {
                            self.boot_node_connection_id = None;
                            self.boot_node_peer_id = None;
                            if self.metrics_connection_id.is_none() {
                                if let Ok(boot_node_url_list) =
                                    Self::parse_legacy_multiaddr(&BOOTNODE_ADDRESS_LIST)
                                {
                                    _ = self.swarm.behaviour_mut().kad.remove_peer(&peer_id);
                                    for boot_node_url in boot_node_url_list {
                                        _ = self.swarm.dial(boot_node_url);
                                    }
                                }
                            }
                        }
                    }
                }
            }
            SwarmEvent::IncomingConnection { connection_id, .. } => {
                if self.metrics_connection_id.is_some() {
                    self.swarm.close_connection(connection_id);
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
        if self.metrics_connection_id.is_none() {
            self.connect_to_boot_metrics_node().await;
        }
    }

    async fn connect_to_boot_metrics_node(&mut self) {
        if let Ok(boot_node_url_list) = Self::parse_legacy_multiaddr(&*LAZY_BOOTNODE_METRICS_LIST) {
            for boot_node_url in boot_node_url_list {
                _ = self.swarm.dial(boot_node_url);
            }
        } else {
            warn!(
                "&*LAZY_BOOTNODE_METRICS_LIST: {:?}, cannot resolve dns",
                &*LAZY_BOOTNODE_METRICS_LIST
            );
        }
    }

    pub async fn send_p2p_event(event: Event) {
        if let Some(event_sender) = LAZY_EVENT_SENDER.lock().unwrap().as_ref() {
            info!("send event: {:?}", event);
            _ = event_sender.send(event);
        }
    }
}
