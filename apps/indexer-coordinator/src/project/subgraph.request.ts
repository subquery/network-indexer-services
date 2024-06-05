// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import axios from 'axios';

export async function requestSubgraph(indexNodeUrl: string, cid: string): Promise<any> {
  try {
    const response = await axios.post(indexNodeUrl, {
      query: `
      query {
        indexingStatuses(subgraphs: ["${cid}"]) {    
          subgraph
          synced
          health
          project {
            id
          }
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
    });
    return response.data.data;
  } catch (error) {
    console.error(`Failed to request subgraph from ${indexNodeUrl} with error: ${error}`);
    return {};
  }
}
