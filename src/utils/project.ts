// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { IPFSClient } from '@subql/network-clients';
import yaml from 'js-yaml';
import { isEqual } from 'lodash';
import { Project, ProjectAdvancedConfig, ProjectBaseConfig } from '../project/project.model';

export function projectConfigChanged(
  project: Project,
  baseConfig: ProjectBaseConfig,
  advancedConfig: ProjectAdvancedConfig,
): boolean {
  return (
    advancedConfig.purgeDB ||
    !isEqual(project.baseConfig, baseConfig) ||
    !isEqual(project.advancedConfig, advancedConfig)
  );
}

// manifest types
export type Runner = {
  node?: {
    name: string;
    version: string;
  };
  query?: {
    name: string;
    version: string;
  };
};

type DataSources = {
  kind: string;
};

export type PartialIpfsDeploymentManifest = {
  dataSources: DataSources[];
  schema: {
    file: string;
  };
  network: {
    chainId?: string;
  };
  specVersion: string;
  runner?: Runner;
};

export enum NodeDockerRegistry {
  substrateNode = 'onfinality/subql-node',
  cosmos = 'onfinality/subql-node-cosmos',
  avalanche = 'onfinality/subql-node-avalanche',
}

export type ChainType = 'cosmos' | 'avalanche' | 'substrate';

export const IPFS_URL = 'https://authipfs.subquery.network/ipfs/api/v0';
const clientSDK = new IPFSClient(IPFS_URL);

// TODO: migrate these logic to client sdk
export async function getManifest(cid: string) {
  const projectYaml = await clientSDK.cat(cid);
  const resultManifest = yaml.load(projectYaml) as PartialIpfsDeploymentManifest;
  return resultManifest;
}

function dockerRegistryFromChain(chainType: ChainType): NodeDockerRegistry {
  switch (chainType) {
    case 'cosmos':
      return NodeDockerRegistry.cosmos;
    case 'avalanche':
      return NodeDockerRegistry.avalanche;
    default:
      return NodeDockerRegistry.substrateNode;
  }
}

export async function nodeConfigs(
  cid: string,
): Promise<{ chainType: ChainType; dockerRegistry: NodeDockerRegistry }> {
  const manifest = await getManifest(cid);
  const { dataSources } = manifest;
  const runtime = dataSources[0].kind;
  const chainType = runtime.split('/')[0] as ChainType;

  return { chainType, dockerRegistry: dockerRegistryFromChain(chainType) };
}

// TODO: use from etherprojects
export const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000';
