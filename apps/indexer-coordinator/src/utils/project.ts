// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Field, ObjectType } from '@nestjs/graphql';
import { IPFSClient, IPFS_URLS } from '@subql/network-clients';
import yaml from 'js-yaml';
import { isEqual } from 'lodash';
import { IProjectConfig, Project } from '../project/project.model';
import { argv } from '../yargs';

@ObjectType('NodeClass')
class NodeClass {
  @Field()
  name: string;
  @Field()
  version: string;
}

@ObjectType('QueryClass')
class QueryClass {
  @Field()
  name: string;
  @Field()
  version: string;
}

// manifest types
@ObjectType('Runner')
class Runner {
  @Field(() => NodeClass)
  node?: NodeClass;
  @Field(() => QueryClass)
  query?: QueryClass;
}

@ObjectType('DataSources')
class DataSources {
  @Field()
  kind: string;
}

@ObjectType('SchemaClass')
class SchemaClass {
  @Field()
  file: string;
}

@ObjectType('NetworkClass')
class NetworkClass {
  @Field()
  chainId: string;
}

@ObjectType('PartialIpfsDeploymentManifest')
export class PartialIpfsDeploymentManifest {
  @Field(() => [DataSources])
  dataSources: DataSources[];
  @Field(() => SchemaClass)
  schema: SchemaClass;
  @Field(() => NetworkClass)
  network: NetworkClass;
  @Field()
  specVersion: string;
  @Field()
  runner?: Runner;
}

export type ChainType =
  | 'near'
  | 'flare'
  | 'cosmos'
  | 'algorand'
  | 'substrate'
  | 'ethereum'
  | 'stellar';

export const IPFS_URL = argv['ipfs'] ?? IPFS_URLS.metadata;
const clientSDK = new IPFSClient(IPFS_URL);

export function projectConfigChanged(project: Project, projectConfig: IProjectConfig): boolean {
  return projectConfig.purgeDB || !isEqual(project.projectConfig, projectConfig);
}

// TODO: migrate these logic to client sdk
export async function getManifest(cid: string) {
  const projectYaml = await clientSDK.cat(cid);
  const resultManifest = yaml.load(projectYaml) as PartialIpfsDeploymentManifest;
  return resultManifest;
}

function dockerRegistryFromChain(chainType: ChainType): string {
  return `subquerynetwork/subql-node-${chainType}`;
}

export async function nodeConfigs(
  cid: string
): Promise<{ chainType: ChainType; dockerRegistry: string }> {
  const manifest = await getManifest(cid);
  const { dataSources } = manifest;
  const runtime = dataSources[0].kind;
  const chainType = runtime.split('/')[0] as ChainType;

  return { chainType, dockerRegistry: dockerRegistryFromChain(chainType) };
}

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000';
