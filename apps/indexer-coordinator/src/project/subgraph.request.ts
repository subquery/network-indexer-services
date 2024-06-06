// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import axios from 'axios';

export interface SubgraphData {
  indexingStatuses: {
    subgraph: string;
    synced: boolean;
    health: string;
    chains: {
      network: string;
      chainHeadBlock: {
        number: number;
      };
      earliestBlock: {
        number: number;
      };
      latestBlock: {
        number: number;
      };
      lastHealthyBlock: {
        number: number;
      };
    }[];
  }[];
}

export async function requestSubgraphNode(
  indexNodeUrl: string,
  cid: string
): Promise<{ success: boolean; data: SubgraphData }> {
  try {
    const response = await axios.request({
      url: indexNodeUrl,
      method: 'POST',
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        query: `
        query {
          indexingStatuses(subgraphs: ["${cid}"]) {    
            subgraph
            synced
            health
            chains{
              network
              chainHeadBlock{
                number
              }
              earliestBlock{
                number
              }
              latestBlock{
                number
              }
              lastHealthyBlock{
                number
              }
            }
          }
        }
      `,
      },
    });
    return { success: true, data: response.data.data };
  } catch (error) {
    console.error(`Failed to request subgraph from ${indexNodeUrl} with error: ${error}`);
    return { success: false, data: null };
  }
}

export interface SubgraphMeta {
  _meta: {
    block: {
      number: number;
      timestamp: number;
      parentHash: string;
    };
  };
}

export async function requestSubgraphMeta(
  httpEndpointUrl: string
): Promise<{ success: boolean; data: SubgraphMeta }> {
  try {
    const response = await axios.request({
      url: httpEndpointUrl,
      method: 'POST',
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        query: `
        query {
          _meta {
            block {
              number
              timestamp
              parentHash
            }
          }
        }
      `,
      },
    });
    return { success: true, data: response.data.data };
  } catch (error) {
    console.error(`Failed to request subgraph meta from ${httpEndpointUrl} with error: ${error}`);
    return { success: false, data: null };
  }
}
