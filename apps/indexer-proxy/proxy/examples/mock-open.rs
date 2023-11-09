use ethers::{
    abi::{Token, Tokenizable},
    prelude::*,
};
use std::env::args;
use std::sync::Arc;
use subql_contracts::{plan_manager, service_agreement_registry, sqtoken, Network};
use subql_indexer_utils::{
    error::Error,
    payg::{convert_string_to_sign, price_recover},
    request::proxy_request,
    tools::{cid_deployment, deployment_cid},
};

// Hardhat default account. just for padding when account missing.
const ACCOUNT: &str = "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const GAS_PRICE: u64 = 1_000_000_000;

async fn init_client(
    sk: &str,
    network: Network,
) -> (
    Arc<SignerMiddleware<Provider<Http>, LocalWallet>>,
    U256,
    Address,
) {
    let default_endpoint = network.config().rpc_urls[0].clone();
    let endpoint = std::env::var("ENDPOINT_HTTP").unwrap_or(default_endpoint);
    let account = sk.parse::<LocalWallet>().unwrap();
    let address = account.address();
    let provider = Provider::<Http>::try_from(endpoint)
        .unwrap()
        .with_sender(account.address());

    let gas_price = provider.get_gas_price().await.unwrap_or(GAS_PRICE.into());

    let client = SignerMiddleware::new_with_provider_chain(provider, account)
        .await
        .unwrap();
    (Arc::new(client), gas_price, address)
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    std::env::set_var("RUST_LOG", "info");
    tracing_subscriber::fmt::init();

    let network = Network::Testnet;

    if let Some(subcommand) = args().nth(1) {
        match subcommand.as_str() {
            "show-templates" => {
                let (client, _, _) = init_client(ACCOUNT, network).await;
                let plan_contract = plan_manager(client.clone(), network).unwrap();
                let result: U256 = plan_contract
                    .method::<_, U256>("nextTemplateId", ())
                    .unwrap()
                    .call()
                    .await
                    .unwrap();
                for i in 0..result.as_u32() - 1 {
                    let result: Token = plan_contract
                        .method::<_, Token>("getPlanTemplate", (i,))
                        .unwrap()
                        .call()
                        .await
                        .unwrap();
                    let tokens = result.into_tuple().unwrap();
                    let period = U256::from_token(tokens[0].clone()).unwrap();
                    let daily = U256::from_token(tokens[1].clone()).unwrap();
                    let rate = U256::from_token(tokens[2].clone()).unwrap();
                    let price_token = Address::from_token(tokens[3].clone()).unwrap();
                    println!(
                        "Templates: {} period: {}s, daily limit: {}/day, rate limit: {}/min, price token: {:?}",
                        i, period, daily, rate, price_token
                    );
                }
            }
            "show-plans" => {
                if args().len() != 3 {
                    println!("cargo run --example mock-open show-plans 0xindexeraddress");
                    return Ok(());
                }
                let indexer: Address = args().nth(2).unwrap().parse().unwrap();

                let (client, _, _) = init_client(ACCOUNT, network).await;
                let plan_contract = plan_manager(client.clone(), network).unwrap();
                let result: U256 = plan_contract
                    .method::<_, U256>("nextPlanId", ())
                    .unwrap()
                    .call()
                    .await
                    .unwrap();
                println!(
                    "Plan contract: {:?}, total plan: {}",
                    plan_contract.address(),
                    result
                );
                if result == U256::zero() {
                    return Ok(());
                }
                for i in 1..result.as_u32() + 1 {
                    let result: Token = plan_contract
                        .method::<_, Token>("getPlan", (i,))
                        .unwrap()
                        .call()
                        .await
                        .unwrap();
                    let tokens = result.into_tuple().unwrap();
                    let pindexer = Address::from_token(tokens[0].clone()).unwrap();
                    let deployment = deployment_cid(&H256::from_token(tokens[3].clone()).unwrap());
                    let price = U256::from_token(tokens[1].clone()).unwrap();
                    if pindexer == indexer {
                        println!(
                            "Plans: {} {} - template: {}, deployment: {}, price: {}",
                            i, tokens[4], tokens[2], deployment, price,
                        );
                    }
                }
            }
            "show-close-agreements" => {
                if args().len() != 3 {
                    println!(
                        "cargo run --example mock-open show-close-agreements 0xindexeraddress"
                    );
                    return Ok(());
                }
                let indexer: Address = args().nth(2).unwrap().parse().unwrap();

                let (client, _, _) = init_client(ACCOUNT, network).await;
                let contract = service_agreement_registry(client.clone(), network).unwrap();
                println!("Service agreement contract: {:?}", contract.address());
                let result: U256 = contract
                    .method::<_, U256>("nextServiceAgreementId", ())
                    .unwrap()
                    .call()
                    .await
                    .unwrap();
                for i in 0..result.as_u32() {
                    let result: Token = contract
                        .method::<_, Token>("getClosedServiceAgreement", (i,))
                        .unwrap()
                        .call()
                        .await
                        .unwrap();
                    let tokens = result.into_tuple().unwrap();
                    let deployment = deployment_cid(&H256::from_token(tokens[2].clone()).unwrap());
                    if indexer == tokens[1].clone().into_address().unwrap() {
                        println!(
                            "Agreement: {}, plan: {}, consumer: 0x{}, deployment: {}",
                            i, tokens[6], tokens[0], deployment
                        );
                    }
                }
            }
            "show-payg" => {
                if args().len() != 3 {
                    println!("cargo run --example mock-open show-payg indexer_url");
                    return Ok(());
                }
                let indexer_url = args().nth(2).unwrap();

                let res =
                    proxy_request("get", &indexer_url, "payg-price", "", String::new(), vec![])
                        .await
                        .unwrap();

                let controller: Address = res["controller"].as_str().unwrap().parse().unwrap();
                for deployment in res["deployments"].as_array().unwrap() {
                    let infos = deployment.as_array().unwrap();
                    let d = infos[0].as_str().unwrap();
                    let price = U256::from_dec_str(infos[1].as_str().unwrap()).unwrap();
                    let token: Address = infos[3].as_str().unwrap().parse().unwrap();
                    let expired: i64 = infos[4].as_i64().unwrap();
                    let sign: Signature = convert_string_to_sign(infos[5].as_str().unwrap());

                    let signer = price_recover(price, token, expired, sign).unwrap();
                    if signer != controller {
                        println!("Invalid signer: {}", signer);
                    }
                    println!("Deployment: {} price: {} {:?} {}", d, price, token, expired);
                }
            }
            "create-plan" => {
                if args().len() != 6 {
                    println!("cargo run --example mock-open create-plan indexersk price template deployment");
                    return Ok(());
                }
                let price = U256::from_dec_str(&args().nth(3).unwrap()).unwrap();
                let template = U256::from_dec_str(&args().nth(4).unwrap()).unwrap();
                let deployment = cid_deployment(&args().nth(5).unwrap());
                println!("price: {} template: {}", price, template);

                let (client, gas_price, _) = init_client(&args().nth(2).unwrap(), network).await;
                let contract = plan_manager(client.clone(), network).unwrap();
                println!("Plan contract: {:?}", contract.address());

                let tx = contract
                    .method::<_, ()>("createPlan", (price, template, deployment))
                    .unwrap()
                    .gas_price(gas_price);
                let pending_tx = tx.send().await.unwrap();
                println!("waiting tx confirmation...");
                let _receipt = pending_tx.confirmations(1).await.unwrap();
            }
            "open-close-agreement" => {
                if args().len() != 6 && args().len() != 5 {
                    println!("cargo run --example mock-open open-close-agreement consumersk deployment plan_id need_allowance");
                    return Ok(());
                }
                let deployment = cid_deployment(&args().nth(3).unwrap());
                let plan = U256::from_dec_str(&args().nth(4).unwrap()).unwrap();
                let need_allowance: bool = if args().len() == 6 {
                    args().nth(5).unwrap().parse().unwrap()
                } else {
                    false
                };

                let (client, gas_price, _) = init_client(&args().nth(2).unwrap(), network).await;
                let contract = plan_manager(client.clone(), network).unwrap();
                println!("Plan contract: {:?}", contract.address());

                if need_allowance {
                    let sqtoken = sqtoken(client, network).unwrap();
                    let amount: U256 = U256::from(100) * U256::from(1000000000000000000u64); // 18-decimal
                    let tx = sqtoken
                        .method::<_, ()>("increaseAllowance", (contract.address(), amount))
                        .unwrap()
                        .gas_price(gas_price);
                    let pending_tx = tx
                        .send()
                        .await
                        .map_err(|err| {
                            if let Some(rcode) = err.decode_revert::<String>() {
                                println!("Error: {}", rcode);
                            } else {
                                println!("Error: {}", err);
                            }
                        })
                        .unwrap();
                    println!("waiting increase allowance tx confirmation...",);
                    let _receipt = pending_tx.confirmations(1).await.unwrap();
                }

                let tx = contract
                    .method::<_, ()>("acceptPlan", (plan, deployment))
                    .unwrap()
                    .gas_price(gas_price);
                let pending_tx = tx
                    .send()
                    .await
                    .map_err(|err| {
                        if let Some(rcode) = err.decode_revert::<String>() {
                            println!("Error: {}", rcode);
                        } else {
                            println!("Error: {}", err);
                        }
                    })
                    .unwrap();
                println!("waiting close agreement tx confirmation...");
                let _receipt = pending_tx.confirmations(1).await.unwrap();
            }
            _ => {
                println!("Invalid subcommand!");
            }
        }
    }

    Ok(())
}
