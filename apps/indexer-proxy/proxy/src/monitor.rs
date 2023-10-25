// This file is part of SubQuery.

// Copyright (C) 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: GPL-3.0-or-later WITH Classpath-exception-2.0

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.

use redis::{AsyncCommands, RedisResult};
use subql_indexer_utils::request::REQUEST_CLIENT;
use sysinfo::{CpuExt, DiskExt, System, SystemExt};
use tokio::sync::{Mutex, OnceCell};

use crate::{
    cli::{redis, COMMAND},
    primitives::{MONITOR_INIT_TIME, MONITOR_LOOP_TIME},
};

static SYS: OnceCell<Mutex<System>> = OnceCell::const_new();

async fn init_sys() -> Mutex<System> {
    Mutex::new(System::new())
}

pub fn listen() {
    tokio::spawn(async {
        tokio::time::sleep(std::time::Duration::from_secs(MONITOR_INIT_TIME)).await;

        loop {
            let (p_cpu, t_mem, p_mem, t_disk, p_disk) = fetch_sysinfo().await;

            let conn = redis();
            let mut conn_lock = conn.lock().await;
            let agreements: RedisResult<Vec<String>> = conn_lock.keys("*-dlimit").await;
            let channels: RedisResult<Vec<String>> = conn_lock.keys("*-channel").await;
            drop(conn_lock);

            let agreement = match agreements {
                Ok(s) => s.len(),
                _ => 0,
            };
            let channel = match channels {
                Ok(s) => s.len(),
                _ => 0,
            };

            let data = serde_json::json!({
                "p_cpu": p_cpu,
                "t_mem": t_mem,
                "p_mem": p_mem,
                "t_disk": t_disk,
                "p_disk": p_disk,
                "addr": &COMMAND.coordinator_endpoint,
                "agreement": agreement,
                "channel": channel,
            });

            let _ = REQUEST_CLIENT
                .post(format!("{}/monitor", COMMAND.coordinator_endpoint))
                .header("content-type", "application/json")
                .json(&data)
                .send()
                .await;

            tokio::time::sleep(std::time::Duration::from_secs(MONITOR_LOOP_TIME)).await;
        }
    });
}

/// get the cpu%, memory_total, memory%, disk_total, disk%
async fn fetch_sysinfo() -> (u64, f64, u64, f64, u64) {
    let mut sys = SYS.get_or_init(init_sys).await.lock().await;
    sys.refresh_cpu();
    let cpu_num = sys.cpus().len() as f32;
    let cpu_total: f32 = sys.cpus().iter().map(|c| c.cpu_usage()).sum();
    let p_cpu = (cpu_total / cpu_num) as u64;

    sys.refresh_memory();
    let mem_total = sys.total_memory();
    let mem_used = sys.used_memory();
    let p_mem = mem_used * 100 / mem_total;
    let mem_gb = (mem_total * 100 / 1073741824) as f64 / 100f64; // GB

    sys.refresh_disks_list();
    let mut disk_total = 0u64;
    let mut disk_used = 0u64;
    for disk in sys.disks() {
        disk_total += disk.total_space();
        disk_used += disk.available_space();
    }
    let p_disk = disk_used * 100 / disk_total;
    let disk_gb = (disk_total * 100 / 1073741824) as f64 / 100f64; // GB

    (p_cpu, mem_gb, p_mem, disk_gb, p_disk)
}
