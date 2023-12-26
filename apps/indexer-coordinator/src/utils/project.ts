// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Field, ObjectType } from '@nestjs/graphql';
import { IPFSClient, IPFS_URLS } from '@subql/network-clients';
import yaml from 'js-yaml';
import { isEqual } from 'lodash';
import { IProjectConfig, Project } from '../project/project.model';
import { argv } from '../yargs';
import { timeoutPromiseHO } from './promise';

@ObjectType('NodeClass')
class NodeClass {
  @Field({ nullable: true })
  name: string;
  @Field({ nullable: true })
  version: string;
}

@ObjectType('QueryClass')
class QueryClass {
  @Field({ nullable: true })
  name: string;
  @Field({ nullable: true })
  version: string;
}

// manifest types
@ObjectType('Runner')
class Runner {
  @Field(() => NodeClass, { nullable: true })
  node?: NodeClass;
  @Field(() => QueryClass, { nullable: true })
  query?: QueryClass;
}

@ObjectType('DataSources')
class DataSources {
  @Field({ nullable: true })
  kind: string;
}

@ObjectType('SchemaClass')
class SchemaClass {
  @Field({ nullable: true })
  file: string;
}

@ObjectType('NetworkClass')
class NetworkClass {
  @Field({ nullable: true })
  chainId: string;
}

@ObjectType('PartialIpfsDeploymentManifest')
export class PartialIpfsDeploymentManifest {
  @Field(() => [DataSources], { nullable: true })
  dataSources: DataSources[];
  @Field(() => SchemaClass, { nullable: true })
  schema: SchemaClass;
  @Field(() => NetworkClass, { nullable: true })
  network: NetworkClass;
  @Field({ nullable: true })
  specVersion: string;
  @Field({ nullable: true })
  runner: Runner;
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
  const projectYaml = await timeoutPromiseHO(30000)(clientSDK.cat(cid));
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
