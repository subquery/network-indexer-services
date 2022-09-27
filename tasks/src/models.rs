use ethers::types::{Address, Bytes, U256};
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use tokio::sync::OnceCell;

pub static DB: OnceCell<PgPool> = OnceCell::const_new();

pub fn db<'a>() -> &'a PgPool {
    DB.get().expect("Database lost connections")
}

pub async fn setup_db() {
    // setup database connection
    let db_url = std::env::var("DATABASE_URL").expect("DATABASE_URL is not set in .env file");
    let db = PgPoolOptions::new()
        .max_connections(5)
        .connect(&db_url)
        .await
        .expect("Database connection failed");
    DB.set(db).expect("Database connection failed");
}

pub async fn channel_checkpoint(id: U256, onchain: U256) {
    let id_string = format!("{:#X}", id);
    let onchain_string = format!("{}", onchain);
    let _ = query!(
        "UPDATE channel SET onchain=$1 WHERE id=$2",
        onchain_string,
        id_string
    )
    .execute(db())
    .await;
}

pub async fn channel_extend(id: U256, expiration: U256) {
    let id_string = format!("{:#X}", id);
    let expiration_int = expiration.as_u64() as i32;
    let _ = query!(
        r#"UPDATE channel SET "expirationAt"=$1 WHERE id=$2"#,
        expiration_int,
        id_string
    )
    .execute(db())
    .await;
}

pub async fn channel_fund(id: U256, total: U256) {
    let id_string = format!("{:#X}", id);
    let total_string = format!("{}", total);
    let _ = query!(
        "UPDATE channel SET total=$1 WHERE id=$2",
        total_string,
        id_string
    )
    .execute(db())
    .await;
}

pub async fn channel_challenge(id: U256, onchain: U256) {
    let id_string = format!("{:#X}", id);
    let onchain_string = format!("{}", onchain);
    let _ = query!(
        "UPDATE channel SET onchain=$1,status=$2 WHERE id=$3",
        onchain_string,
        2, // ChannelStatus::CHALLENGE
        id_string
    )
    .execute(db())
    .await;
}

pub async fn channel_respond(id: U256, onchain: U256) {
    let id_string = format!("{:#X}", id);
    let onchain_string = format!("{}", onchain);
    let _ = query!(
        "UPDATE channel SET onchain=$1,status=$2 WHERE id=$3",
        onchain_string,
        1, // ChannelStatus::OPEN
        id_string
    )
    .execute(db())
    .await;
}

pub async fn channel_finalize(id: U256, total: U256, remain: U256) {
    let id_string = format!("{:#X}", id);
    let onchain_string = format!("{}", total - remain);
    let _ = query!(
        "UPDATE channel SET onchain=$1,status=$2 WHERE id=$3",
        onchain_string,
        0, // ChannelStatus::FINALIZE
        id_string
    )
    .execute(db())
    .await;
}

pub async fn channel_labor(deployment_id: Bytes, indexer: Address, amount: U256, time: u64) {
    let deployment_string = deployment_cid(&deployment_id);
    let indexer_string = format!("{:?}", indexer);
    let total_string = format!("{}", amount);
    let _ = query!(
        r#"
          INSERT INTO channel_labor("deploymentId",indexer,total,"createdAt")
          VALUES ($1,$2,$3,$4)
        "#,
        deployment_string,
        indexer_string,
        total_string,
        time as i32
    )
    .execute(db())
    .await;
}

pub async fn init_chain_block() -> u64 {
    let res = query!("SELECT value FROM chain_info WHERE name = 'block'")
        .fetch_one(db())
        .await;

    if let Ok(res) = res {
        res.value.parse::<u64>().unwrap()
    } else {
        let _ = query!("INSERT INTO chain_info(name,value) VALUES ('0', 'block')")
            .execute(db())
            .await;
        0
    }
}

pub async fn update_chain_block(block: u64) {
    let _ = query!(
        "UPDATE chain_info SET value=$1 WHERE name = 'block'",
        format!("{}", block)
    )
    .execute(db())
    .await;
}

fn deployment_cid(deployment: &[u8]) -> String {
    if deployment.len() != 32 {
        return "".to_owned();
    }
    // Add our default ipfs values for first 2 bytes:
    // function:0x12=sha2, size:0x20=256 bits
    // and cut off leading "0x"
    let mut bytes = [0u8; 34];
    bytes[0] = 18;
    bytes[1] = 32;
    bytes[2..].copy_from_slice(deployment);
    bs58::encode(&bytes).into_string()
}
