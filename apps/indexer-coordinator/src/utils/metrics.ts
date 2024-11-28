// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

export enum MetricsType {
  UNKNOWN = 'unknown',
  GETH_PROMETHEUS = 'geth_prom',
  ERIGON_PROMETHEUS = 'erigon_prom',
  NETHERMIND_PROMETHEUS = 'nethermind_prom',
  RETH_PROMETHEUS = 'reth_prom',
  BESU_PROMETHEUS = 'besu_prom',
}

function extractFromBrace(content: string) {
  const res: { [key: string]: string } = {};
  const match = content.match(/\{(.*)\}/);
  if (match) {
    for (const pair of match[1].split(',')) {
      const [key, value] = pair.split('=');
      res[key.trim()] = value.replace(/"/g, '').trim();
    }
  }
  return res;
}

function extractFromGauge(content: string) {
  const res: { [key: string]: string } = {};
  content = content.replace(/\{(.*)\}/, '');
  const data = content.split(' ');
  if (data.length) {
    res[data[0]] = data[1];
  }
  return res;
}

export type MetricsData = {
  mType: MetricsType;

  // geth
  chain_id?: string;
  chain_head_block?: string;

  // erigon
  chain_checkpoint_latest?: string;
  p2p_peers?: string;
  pool_new_block_count?: string;

  // nethermind
  nethermind_blocks?: string;

  // reth
  reth_blockchain_tree_canonical_chain_height?: string;

  // besu & nethermind
  ethereum_blockchain_height?: string;
};

// eslint-disable-next-line complexity
export function parseMetrics(metrics: string): MetricsData {
  metrics = metrics || '';
  let mType: MetricsType = MetricsType.UNKNOWN;
  const parsedData: MetricsData = {
    mType,
  };

  const lines = metrics.split('\n');
  for (let i = 0; i < lines.length; i++) {
    // geth
    if (lines[i].startsWith('# TYPE geth_info')) {
      mType = MetricsType.GETH_PROMETHEUS;
    }
    if (lines[i].startsWith('# TYPE chain_info')) {
      /**
        # TYPE chain_info gauge
        chain_info {chain_id="8453"} 1
      */
      const next = lines[i + 1] || '';
      if (next.startsWith('chain_info')) {
        const chainInfo = extractFromBrace(next.slice(10));
        Object.assign(parsedData, chainInfo);
      }
    }
    if (lines[i].startsWith('# TYPE chain_head_block gauge')) {
      /**
        # TYPE chain_head_block gauge
        chain_head_block 0
      */
      const next = lines[i + 1] || '';
      if (next.startsWith('chain_head_block')) {
        const headBlockInfo = extractFromGauge(next);
        Object.assign(parsedData, headBlockInfo);
      }
    }

    // erigon
    if (lines[i].startsWith('# TYPE erigon_info')) {
      mType = MetricsType.ERIGON_PROMETHEUS;
    }
    if (lines[i].startsWith('# TYPE chain_checkpoint_latest gauge')) {
      /**
        # TYPE chain_checkpoint_latest gauge
        chain_checkpoint_latest 0
      */
      const next = lines[i + 1] || '';
      if (next.startsWith('chain_checkpoint_latest')) {
        const cpInfo = extractFromGauge(next);
        Object.assign(parsedData, cpInfo);
      }
    }
    if (lines[i].startsWith('# TYPE p2p_peers gauge')) {
      /**
        # TYPE p2p_peers gauge
        p2p_peers 81
      */
      const next = lines[i + 1] || '';
      if (next.startsWith('p2p_peers')) {
        const peersInfo = extractFromGauge(next);
        Object.assign(parsedData, peersInfo);
      }
    }
    if (lines[i].startsWith('pool_new_block_count')) {
      /**
        pool_new_block_count 184
      */
      const pbInfo = extractFromGauge(lines[i]);
      Object.assign(parsedData, pbInfo);
    }

    // nethermind
    if (lines[i].startsWith('# TYPE nethermind_blocks gauge')) {
      mType = MetricsType.NETHERMIND_PROMETHEUS;
      /**
        # TYPE nethermind_blocks gauge
        nethermind_blocks{Instance="Mainnet",Network="Mainnet",SyncType="Snap",PruningMode="Hybrid",Version="1.29.1+dfea5240",Commit="dfea52404006c6ce1b133b98f324dbfcb62773e1",Runtime=".NET 8.0.10",BuildTimestamp="1729083572"} 0
      */
      const next = lines[i + 1] || '';
      if (next.startsWith('nethermind_blocks')) {
        const blocksInfo = extractFromGauge(next);
        Object.assign(parsedData, blocksInfo);
      }
    }

    // reth
    if (lines[i].startsWith('# TYPE reth_blockchain_tree_canonical_chain_height gauge')) {
      mType = MetricsType.RETH_PROMETHEUS;
      /**
        # TYPE reth_blockchain_tree_canonical_chain_height gauge
        reth_blockchain_tree_canonical_chain_height 0
      */
      const next = lines[i + 1] || '';
      if (next.startsWith('reth_blockchain_tree_canonical_chain_height')) {
        const blocksInfo = extractFromGauge(next);
        Object.assign(parsedData, blocksInfo);
      }
    }

    // besu
    if (lines[i].startsWith('# TYPE besu_blockchain_difficulty_total gauge')) {
      mType = MetricsType.BESU_PROMETHEUS;
    }
    if (lines[i].startsWith('# TYPE ethereum_blockchain_height gauge')) {
      /**
        # TYPE ethereum_blockchain_height gauge
        ethereum_blockchain_height 0.0
      */
      const next = lines[i + 1] || '';
      if (next.startsWith('ethereum_blockchain_height')) {
        const blocksInfo = extractFromGauge(next);
        Object.assign(parsedData, blocksInfo);
      }
    }
  }

  parsedData.mType = mType;
  return parsedData;
}
