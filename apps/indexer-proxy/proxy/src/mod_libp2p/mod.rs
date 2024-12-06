use crate::mod_libp2p::{
    behavior::{AgentBehavior, AgentEvent},
    message::{AgentMessage, GreeRequest, GreetResponse},
};
use base64::{engine::general_purpose::STANDARD, Engine};
use either::Either;
use libp2p::{
    core::transport::upgrade::Version,
    futures::StreamExt,
    gossipsub,
    identify::{Behaviour as IdentifyBehavior, Config as IdentifyConfig},
    identity::{self, Keypair},
    kad::{store::MemoryStore as KadInMemory, Behaviour as KadBehavior, Config as KadConfig},
    multiaddr::Protocol,
    noise, ping,
    pnet::{PnetConfig, PreSharedKey},
    request_response::{
        cbor::Behaviour as RequestResponseBehavior, Config as RequestResponseConfig,
        Event as RequestResponseEvent, Message as RequestResponseMessage,
        ProtocolSupport as RequestResponseProtocolSupport,
    },
    swarm::SwarmEvent,
    tcp, yamux, Multiaddr, PeerId, StreamProtocol, Swarm, Transport,
};
use std::{
    collections::hash_map::DefaultHasher,
    env,
    error::Error,
    hash::{Hash, Hasher},
    path::Path,
    str::FromStr,
    time::Duration,
};
use tokio::time;
use tracing::info;

pub mod behavior;
pub mod message;

const BOOTNODES: [&str; 2] = [
    "16Uiu2HAmGhmfeYmefx3fJGkojaUBkWS8oYZrkmYmXZ3Ey844qLwf",
    "16Uiu2HAmLiJHsiwFyVEXnN6QvdH1eVBrsaTNdPqA6xxJbTf1bMbz",
];

const TESTNET_ADDRESS: [&str; 2] = ["/ip4/192.168.1.136/tcp/8002", "/ip4/192.168.1.136/tcp/8003"];

pub async fn start_swarm() -> Result<(Swarm<AgentBehavior>, Keypair), Box<dyn Error + Send + Sync>>
{
    std::env::set_var(
        "PRIVITE_NET_KEY",
        "wiwlLGQ8g6zu0mcckkROzeeAU7xN+Adz40ELWSH3f1M=",
    );
    std::env::set_var("PRIVITE_NET_ADDRESS", "/ip4/0.0.0.0/tcp/8004");
    let psk = get_psk();
    println!("file: {}, line: {}", file!(), line!());
    if let Ok(psk) = psk {
        println!("file: {}, line: {}", file!(), line!());
        warn!("using swarm key with fingerprint: {}", psk.fingerprint());
        println!("file: {}, line: {}", file!(), line!());
    }
    println!("file: {}, line: {}", file!(), line!());

    // Create a Gosspipsub topic
    let gossipsub_topic = gossipsub::IdentTopic::new("chat");

    let local_key = identity::Keypair::generate_secp256k1();

    let mut swarm = libp2p::SwarmBuilder::with_existing_identity(local_key.clone())
        .with_tokio()
        .with_other_transport(|key| {
            let noise_config = noise::Config::new(key).unwrap();
            let yamux_config = yamux::Config::default();

            let base_transport = tcp::tokio::Transport::new(tcp::Config::default().nodelay(true));
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

            // for to_dial in TESTNET_ADDRESS {
            //     if let Ok(addr) = parse_legacy_multiaddr(&to_dial) {
            //         for peer_address in &BOOTNODES {
            //             if let Ok(peer) = PeerId::from_str(peer_address) {
            //                 kad.add_address(&peer, addr.clone());
            //             }
            //         }
            //     }
            // }
            // _ = kad.bootstrap();

            let identify_config =
                IdentifyConfig::new("/agent/connection/1.0.0".to_string(), key.clone().public())
                    .with_push_listen_addr_updates(true)
                    .with_interval(Duration::from_secs(30));

            let rr_config = RequestResponseConfig::default();
            let rr_protocol = StreamProtocol::new("/agent/message/1.0.0");
            let rr_behavior = RequestResponseBehavior::<Vec<u8>, Vec<u8>>::new(
                [(rr_protocol, RequestResponseProtocolSupport::Full)],
                rr_config,
            );

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
            AgentBehavior::new(kad, identify, rr_behavior, gossipsub, ping)
        })?
        .with_swarm_config(|c| c.with_idle_connection_timeout(Duration::from_secs(60)))
        .build();

    swarm
        .behaviour_mut()
        .gossipsub
        .subscribe(&gossipsub_topic)
        .unwrap();

    for to_dial in TESTNET_ADDRESS {
        let addr: Multiaddr = parse_legacy_multiaddr(&to_dial)?;
        swarm.dial(addr)?;
        println!("Dialed {to_dial:?}")
    }

    let private_net_address =
        std::env::var("PRIVITE_NET_ADDRESS").unwrap_or("/ip4/0.0.0.0/tcp/8004".to_string());
    warn!("private_net_address: {}", private_net_address);
    let private_net_address = private_net_address.parse()?;
    swarm.listen_on(private_net_address)?;

    Ok((swarm, local_key))
}

pub async fn handle_swarm_event(mut swarm: Swarm<AgentBehavior>, local_key: Keypair) {
    let mut interval1 = time::interval(Duration::from_secs(8));
    let mut interval2 = time::interval(Duration::from_secs(16));
    tokio::spawn(async move {
        loop {
            tokio::select! {
                event = swarm.next() => {
                    match event {
                        Some(event) => {
                            warn!("Event: {:?}", event);
                            handle_event(event).await;
                        },
                        None => warn!("No event received from swarm"),
                    }
                }
                _ = interval1.tick() => {
                    warn!("Interval1 tick");
                    let local_peer_id = local_key.public().to_peer_id();
                    let request = GreeRequest {
                        message: format!("Send message from: {local_peer_id}: Hello gaess"),
                    };
                    let request_message = AgentMessage::GreeRequest(request);
                    for peer_id_address in BOOTNODES {
                        match peer_id_address.parse() {
                            Ok(peer_id) => {
                                let request_id = swarm
                                    .behaviour_mut()
                                    .send_message(&peer_id, request_message.clone());
                                warn!("Peer ID Address: {peer_id_address}, Peer ID: {peer_id:?}, Request ID: {request_id}, Request Message: {request_message:?}, task id : {:?}", tokio::task::id());
                            },
                            Err(err) => warn!("Error: {:?}, Peer ID Address: {}", err, peer_id_address),
                        }
                    }
                    interval1 = time::interval(Duration::from_secs(8));
                    interval1.reset();
                }
                _ = interval2.tick() => {
                    warn!("Interval2 tick");
                    let local_peer_id = local_key.public().to_peer_id();
                    let request = GreeRequest {
                        message: format!("Send message from: {local_peer_id}, current time is {}", chrono::Local::now()),
                    };
                    let request_message = AgentMessage::GreeRequest(request);
                    swarm.behaviour_mut().broadcast(request_message);
                    interval2 = time::interval(Duration::from_secs(16));
                    interval2.reset();
                }
            }
        }
    });
}

async fn handle_event(swarm_event: SwarmEvent<AgentEvent>) {
    match swarm_event {
        SwarmEvent::Behaviour(AgentEvent::RequestResponse(RequestResponseEvent::Message {
            peer,
            message,
        })) => match message {
            RequestResponseMessage::Response {
                request_id,
                response,
            } => {
                let parsed_response =
                    AgentMessage::from_binary(&response).expect("Failed to decode response");
                match parsed_response {
                    AgentMessage::GreetResponse(res) => {
                        warn!(
                            "RequestResponseEvent::Message::Response -> PeerID: {peer} | RequestID: \
                             {request_id} | Response: {0:?}",
                            res.message
                        )
                    }
                    _ => {
                        warn!("Received unknown response type.");
                    }
                }
            }
            _ => {}
        },
        _ => {
            warn!("swarm_event is {:?}", swarm_event);
        }
    }
}

/// Get the current ipfs repo path, either from the IPFS_PATH environment variable or
/// from the default $HOME/.ipfs
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
fn get_psk() -> Result<PreSharedKey, Box<dyn Error>> {
    println!("file: {}, line: {}", file!(), line!());
    let base64_key =
        std::env::var("PRIVITE_NET_KEY").map_err(|_| "PRIVITE_NET_KEY missing in .env")?;
    println!("file: {}, line: {}", file!(), line!());
    let bytes = STANDARD.decode(&base64_key)?;
    println!("file: {}, line: {}", file!(), line!());
    let key: [u8; 32] = bytes
        .try_into()
        .map_err(|_| "Decoded key must be 32 bytes long")?;
    println!("file: {}, line: {}", file!(), line!());
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
