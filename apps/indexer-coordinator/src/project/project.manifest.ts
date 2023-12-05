// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Field, ObjectType } from '@nestjs/graphql';
import { IPFSClient, IPFS_URLS } from '@subql/network-clients';
import * as yaml from 'js-yaml';
import { PartialIpfsDeploymentManifest } from 'src/utils/project';

export const ipfsClient = new IPFSClient(IPFS_URLS.project);

export async function getProjectManifest(cid: string): Promise<any> {
  const manifestStr = await ipfsClient.cat(cid);
  return await yaml.load(manifestStr, { schema: yaml.FAILSAFE_SCHEMA });
}

@ObjectType('SubqueryManifest')
export class SubqueryManifest extends PartialIpfsDeploymentManifest {}

@ObjectType('ChainClass')
class ChainClass {
  @Field(() => String, { nullable: true })
  chainId?: string;
  @Field(() => String, { nullable: true })
  genesisHash?: string;
}

@ObjectType('ClientClass')
class ClientClass {
  @Field(() => String, { nullable: true })
  name: string;
  @Field(() => String, { nullable: true })
  version: string;
}

@ObjectType('RpcManifest')
export class RpcManifest {
  @Field(() => String, { nullable: true })
  kind?: string;
  @Field(() => String, { nullable: true })
  specVersion?: string;
  @Field(() => String, { nullable: true })
  name?: string;
  @Field(() => ChainClass, { nullable: true })
  chain?: ChainClass;
  @Field(() => String, { nullable: true })
  version?: string;
  @Field(() => [String], { nullable: true })
  rpcFamily?: string[];
  @Field(() => String, { nullable: true })
  nodeType?: string;
  @Field(() => ClientClass, { nullable: true })
  client?: ClientClass;
  @Field(() => [String], { nullable: true })
  featureFlags?: string[];
}

@ObjectType('AggregatedManifest')
export class AggregatedManifest {
  @Field(() => SubqueryManifest)
  subqueryManifest?: SubqueryManifest;
  @Field(() => RpcManifest)
  rpcManifest?: RpcManifest;
}
