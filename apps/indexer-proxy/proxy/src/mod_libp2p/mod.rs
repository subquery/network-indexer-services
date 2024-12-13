use crate::mod_libp2p::{
    behavior::{AgentBehavior, AgentEvent},
    message::{AgentMessage, GreetRequest},
};
use base64::{engine::general_purpose::STANDARD, Engine};
use either::Either;
use libp2p::{
    core::transport::upgrade::Version,
    futures::StreamExt,
    gossipsub::{self, IdentTopic},
    identify::{Behaviour as IdentifyBehavior, Config as IdentifyConfig},
    identity::{self, Keypair},
    kad::{store::MemoryStore as KadInMemory, Behaviour as KadBehavior, Config as KadConfig},
    mdns,
    multiaddr::Protocol,
    noise, ping,
    pnet::{PnetConfig, PreSharedKey},
    request_response::{
        cbor::Behaviour as RequestResponseBehavior, Config as RequestResponseConfig,
        Event as RequestResponseEvent, Message as RequestResponseMessage, OutboundRequestId,
        ProtocolSupport as RequestResponseProtocolSupport,
    },
    swarm::SwarmEvent,
    tcp, yamux, Multiaddr, PeerId, StreamProtocol, Swarm, Transport,
};
use once_cell::sync::Lazy;
use std::{
    collections::hash_map::DefaultHasher,
    error::Error,
    hash::{Hash, Hasher},
    str::FromStr,
    time::Duration,
};
use std::{collections::HashMap, sync::Arc};
use tokio::{
    sync::{
        mpsc::{self, Sender},
        oneshot::Sender as OneShotSender,
        Mutex, OnceCell,
    },
    time::{self, sleep},
};
use tracing::info;

pub mod behavior;
pub mod message;

const BOOTNODES: [&str; 2] = [
    "16Uiu2HAmGhmfeYmefx3fJGkojaUBkWS8oYZrkmYmXZ3Ey844qLwf",
    "16Uiu2HAmLiJHsiwFyVEXnN6QvdH1eVBrsaTNdPqA6xxJbTf1bMbz",
];

const TESTNET_ADDRESS: [&str; 2] = ["/ip4/192.168.1.136/tcp/8002", "/ip4/192.168.1.136/tcp/8003"];

pub const PRIVITE_NET_KEY: Option<&'static str> = option_env!("PRIVITE_NET_KEY");

pub static RR_SENDER: OnceCell<Sender<(String, OneShotSender<()>)>> = OnceCell::const_new();

pub static ONE_SENDER_MAP: Lazy<
    OnceCell<Arc<Mutex<HashMap<OutboundRequestId, OneShotSender<()>>>>>,
> = Lazy::new(|| OnceCell::new());

pub async fn start_libp2p_process() {
    tokio::spawn(async move {
        // Create a Gosspipsub topic
        let gossipsub_topic = gossipsub::IdentTopic::new("chat");

        let local_key = identity::Keypair::generate_secp256k1();
        let mut backoff = Duration::from_secs(1);
        loop {
            match monitor_libp2p_connection(local_key.clone(), &gossipsub_topic).await {
                Ok(_) => {
                    backoff = Duration::from_secs(1); // Reset backoff on success
                }
                Err(_e) => {
                    sleep(backoff).await;
                    backoff = (backoff * 2).min(Duration::from_secs(60)); // Cap backoff
                }
            }
        }
    });
}

pub async fn monitor_libp2p_connection(
    local_key: Keypair,
    gossipsub_topic: &IdentTopic,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let (mut swarm, multiaddr_list) = start_swarm(local_key.clone(), gossipsub_topic).await?;

    // Main monitoring loop
    loop {
        if let Err(_) =
            handle_swarm_event(&mut swarm, local_key.clone(), multiaddr_list.clone()).await
        {
            break Err("error".into());
        }
    }
}

pub async fn start_swarm(
    local_key: Keypair,
    gossipsub_topic: &IdentTopic,
) -> Result<(Swarm<AgentBehavior>, Vec<Multiaddr>), Box<dyn Error + Send + Sync>> {
    ONE_SENDER_MAP
        .set(Arc::new(Mutex::new(HashMap::new())))
        .map_err(|_| "Failed to initialize ONE_SENDER_Map")?;
    let psk = get_psk();
    if let Ok(psk) = psk {
        info!("using swarm key with fingerprint: {}", psk.fingerprint());
    }
    let mut swarm = libp2p::SwarmBuilder::with_existing_identity(local_key.clone())
        .with_tokio()
        .with_other_transport(|key| {
            let noise_config = noise::Config::new(key).unwrap();
            let mut yamux_config = yamux::Config::default();
            yamux_config.set_max_num_streams(1024 * 1024);

            let base_transport =
                tcp::tokio::Transport::new(tcp::Config::default().ttl(64).nodelay(true));
            let maybe_encrypted = match psk {
                Ok(psk) => Either::Left(
                    base_transport
                        .and_then(move |socket, _| PnetConfig::new(psk).handshake(socket)),
                ),
                Err(_) => Either::Right(base_transport),
            };
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
            let rr_behavior = RequestResponseBehavior::<AgentMessage, AgentMessage>::new(
                [(rr_protocol, RequestResponseProtocolSupport::Full)],
                rr_config,
            );

            let identify_config =
                IdentifyConfig::new("/agent/connection/1.0.0".to_string(), key.clone().public())
                    .with_push_listen_addr_updates(true)
                    .with_interval(Duration::from_secs(30));
            let identify = IdentifyBehavior::new(identify_config);

            let message_id_fn = |message: &gossipsub::Message| {
                let mut s = DefaultHasher::new();
                message.data.hash(&mut s);
                gossipsub::MessageId::from(s.finish().to_string())
            };
            // Set a custom gossipsub configuration
            let gossipsub_config = gossipsub::ConfigBuilder::default()
                .heartbeat_interval(Duration::from_secs(10)) // This is set to aid debugging by not cluttering the log space
                .validation_mode(gossipsub::ValidationMode::Strict) // This sets the kind of message validation. The default is Strict (enforce message signing)
                .message_id_fn(message_id_fn) // content-address messages. No two messages of the same content will be propagated.
                .build()
                .unwrap();

            // build a gossipsub network behaviour
            let gossipsub = gossipsub::Behaviour::new(
                gossipsub::MessageAuthenticity::Signed(key.clone()),
                gossipsub_config,
            )
            .unwrap();

            let ping =
                ping::Behaviour::new(ping::Config::new().with_interval(Duration::from_secs(10)));

            let mdns = mdns::tokio::Behaviour::new(mdns::Config::default(), local_peer_id).unwrap();
            AgentBehavior::new(kad, identify, rr_behavior, gossipsub, ping, mdns)
        })?
        .with_swarm_config(|c| c.with_idle_connection_timeout(Duration::from_secs(60)))
        .build();

    for (peer, addr) in BOOTNODES.iter().zip(TESTNET_ADDRESS.iter()) {
        let peer_id: PeerId = peer.parse()?;
        let multiaddr: Multiaddr = addr.parse()?;
        swarm.behaviour_mut().kad.add_address(&peer_id, multiaddr);
    }

    swarm
        .behaviour_mut()
        .gossipsub
        .subscribe(gossipsub_topic)
        .unwrap();

    let mut multiaddr_list: Vec<Multiaddr> = vec![];

    for to_dial in TESTNET_ADDRESS {
        let addr: Multiaddr = parse_legacy_multiaddr(&to_dial)?;
        multiaddr_list.push(addr.clone());
        let _ = swarm.dial(addr)?;
    }

    let private_net_address =
        std::env::var("PRIVITE_NET_ADDRESS").unwrap_or("/ip4/0.0.0.0/tcp/8004".to_string());
    let private_net_address = private_net_address.parse()?;
    swarm.listen_on(private_net_address)?;

    Ok((swarm, multiaddr_list))
}

pub async fn handle_swarm_event(
    swarm: &mut Swarm<AgentBehavior>,
    local_key: Keypair,
    multiaddr_list: Vec<Multiaddr>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let mut interval1 = time::interval(Duration::from_secs(8));
    let mut interval2 = time::interval(Duration::from_secs(16));
    let peer_id_list: Vec<PeerId> = BOOTNODES
        .iter()
        .filter_map(|peer_id_address| match peer_id_address.parse() {
            Ok(peer_id) => Some(peer_id),
            Err(_err) => None,
        })
        .collect();
    let (rr_send, mut rr_recv) = mpsc::channel(1024);
    RR_SENDER
        .set(rr_send.clone())
        .expect("libp2p request response SENDER failure");
    loop {
        tokio::select! {
            event = swarm.next() => {
                match event {
                    Some(event) => {
                        if let Err(e) = handle_event(swarm, event, &peer_id_list, &multiaddr_list).await {
                            info!("Error handling swarm event: {}", e);
                            break;
                        }
                    },
                    None => warn!("No event received from swarm"),
                }
            }
            Some((rr_msg, msg_oneshot_sender)) = rr_recv.recv() => {
                let request = GreetRequest {
                    message: rr_msg,
                };
                let request_message = AgentMessage::GreetRequest(request);
                if let Some(peer_id) = &peer_id_list.get(0) {
                    let request_id = swarm
                        .behaviour_mut()
                        .send_message(peer_id, request_message.clone());
                    if let Some(map) = ONE_SENDER_MAP.get() {
                        let mut write_guard = map.lock().await;
                        write_guard.insert(request_id, msg_oneshot_sender);
                    }
                }
            },
            _ = interval1.tick() => {
                let local_peer_id = local_key.public().to_peer_id();
                let request = GreetRequest {
                    message: format!("Send message from: {local_peer_id}: Hello gaess"),
                };
                let request_message = AgentMessage::GreetRequest(request);
                for peer_id in &peer_id_list {
                    let _request_id = swarm
                        .behaviour_mut()
                        .send_message(peer_id, request_message.clone());
                }
                interval1 = time::interval(Duration::from_secs(8));
                interval1.reset();
            }
            _ = interval2.tick() => {
                let local_peer_id = local_key.public().to_peer_id();
                let request = GreetRequest {
                    message: format!("Send message from: {local_peer_id}, current time is {}", chrono::Local::now()),
                };
                let request_message = AgentMessage::GreetRequest(request);
                swarm.behaviour_mut().broadcast(request_message);
                interval2 = time::interval(Duration::from_secs(16));
                interval2.reset();
            }
        }
    }
    Err("error".into())
}

async fn handle_event(
    _swarm: &mut Swarm<AgentBehavior>,
    swarm_event: SwarmEvent<AgentEvent>,
    _peer_id_list: &[PeerId],
    _multiaddr_list: &[Multiaddr],
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    match swarm_event {
        SwarmEvent::Behaviour(AgentEvent::RequestResponse(RequestResponseEvent::Message {
            message,
            ..
        })) => match message {
            RequestResponseMessage::Response {
                request_id,
                response,
            } => {
                if let Some(map) = ONE_SENDER_MAP.get() {
                    let mut write_guard = map.lock().await;
                    if let Some(msg_oneshot_sender) = write_guard.remove(&request_id) {
                        _ = msg_oneshot_sender.send(());
                    }
                }

                // let parsed_response =
                //     AgentMessage::from_binary(&response).expect("Failed to decode response");
                match response {
                    AgentMessage::GreetResponse(..) => {}
                    _ => {
                        warn!("Received unknown response type.");
                    }
                }
            }

            _ => {}
        },
        // SwarmEvent::Behaviour(AgentEvent::RequestResponse(
        //     RequestResponseEvent::OutboundFailure { peer, .. },
        // )) => {
        //     warn!("peerid is {}, peer_id list is {:?}", peer, peer_id_list);
        //     if peer_id_list.contains(&peer) {
        //         warn!("send msg to  {} fail, restart libp2p", peer);
        //         return Err(format!("send msg to {} fail, restart libp2p", peer).into());
        //     }
        // }
        // SwarmEvent::ConnectionClosed { peer_id: _, .. } => {
        //     for to_dial in TESTNET_ADDRESS {
        //         let addr: Multiaddr = parse_legacy_multiaddr(&to_dial)?;
        //         _ = swarm.dial(addr)?;
        //     }
        // }
        // SwarmEvent::OutgoingConnectionError { error: _, .. } => {
        //     for to_dial in TESTNET_ADDRESS {
        //         let addr: Multiaddr = parse_legacy_multiaddr(&to_dial)?;
        //         _ = swarm.dial(addr);
        //     }
        // }
        SwarmEvent::NewListenAddr { address, .. } => {
            info!("Swarm is now listening on address: {}", address);
        }
        SwarmEvent::IncomingConnection { .. } => {
            info!("Incoming connection detected");
        }
        _ => {}
    }
    Ok(())
}

/// Read the pre shared key file from the given ipfs directory
fn get_psk() -> Result<PreSharedKey, Box<dyn Error + Send + Sync>> {
    let base64_key = PRIVITE_NET_KEY.expect("PRIVITE_NET_KEY missing in .env");
    warn!("base64_key: {}", base64_key);
    let bytes = STANDARD.decode(&base64_key)?;
    let key: [u8; 32] = bytes
        .try_into()
        .map_err(|_| "Decoded key must be 32 bytes long")?;
    Ok(PreSharedKey::new(key))
}

/// for a multiaddr that ends with a peer id, this strips this suffix. Rust-libp2p
/// only supports dialing to an address without providing the peer id.
fn strip_peer_id(addr: &mut Multiaddr) {
    let last = addr.pop();
    match last {
        Some(Protocol::P2p(peer_id)) => {
            let mut addr = Multiaddr::empty();
            addr.push(Protocol::P2p(peer_id));
            info!("removing peer id {addr} so this address can be dialed by rust-libp2p");
        }
        Some(other) => addr.push(other),
        _ => {}
    }
}

/// parse a legacy multiaddr (replace ipfs with p2p), and strip the peer id
/// so it can be dialed by rust-libp2p
fn parse_legacy_multiaddr(text: &str) -> Result<Multiaddr, Box<dyn Error + Send + Sync>> {
    let sanitized = text
        .split('/')
        .map(|part| if part == "ipfs" { "p2p" } else { part })
        .collect::<Vec<_>>()
        .join("/");
    let mut res = Multiaddr::from_str(&sanitized)?;
    strip_peer_id(&mut res);
    Ok(res)
}
