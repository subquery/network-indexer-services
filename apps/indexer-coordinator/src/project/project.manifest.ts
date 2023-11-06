// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { IPFSClient, IPFS_URLS } from '@subql/network-clients';
import * as yaml from 'js-yaml';
import { PartialIpfsDeploymentManifest } from 'src/utils/project';

export const ipfsClient = new IPFSClient(IPFS_URLS.project);

export async function getProjectManifest(cid: string): Promise<any> {
  const manifestStr = await ipfsClient.cat(cid);
  return await yaml.load(manifestStr);
}

export type SubqueryManifest = PartialIpfsDeploymentManifest;

export type RpcManifest = {
  kind?: string;
  specVersion?: string;
  name?: string;
  chain?: {
    chainId?: string;
    genesisHash?: string;
  };
  version?: string;
  rpcFamily?: string[];
  nodeType?: string;
  client?: {
    name?: string;
    version?: string;
  };
  featureFlags?: string[];
};
