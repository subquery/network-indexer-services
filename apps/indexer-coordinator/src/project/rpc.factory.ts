// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import axios from 'axios';
import { BigNumber } from 'ethers';
import _ from 'lodash';
import * as semver from 'semver';
import { getLogger } from 'src/utils/logger';

const logger = getLogger('rpc.factory');

export function getRpcFamilyObject(rpcFamily: string): IRpcFamily | undefined {
  let family: IRpcFamily;
  switch (rpcFamily) {
    case 'evm':
      family = new RpcFamilyEvm();
      break;
    case 'substrate':
      family = new RpcFamilySubstrate();
      break;
    default:
      break;
  }
  return family;
}

function jsonRpcRequest(endpoint: string, method: string, params: any[]): Promise<any> {
  if (!endpoint) {
    return Promise.reject(new Error('Endpoint is empty'));
  }
  return axios.post(
    endpoint,
    {
      jsonrpc: '2.0',
      id: 1,
      method,
      params,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    }
  );
}

export interface IRpcFamily {
  getEndpointKeys(): string[];
  withChainId(chainId: string): IRpcFamily;
  withGenesisHash(genesisHash: string): IRpcFamily;
  withNodeType(nodeType: string): IRpcFamily;
  withClientNameAndVersion(clientName: string, clientVersion: string): IRpcFamily;
  withClientVersion(clientVersion: string): IRpcFamily;
  validate(endpoint: string): Promise<void>;
  getStartHeight(endpoint: string): Promise<number>;
  getTargetHeight(endpoint: string): Promise<number>;
  getLastHeight(endpoint: string): Promise<number>;
  getLastTimestamp(endpoint: string): Promise<number>;
}

abstract class RpcFamily implements IRpcFamily {
  protected actions: (() => Promise<any>)[] = [];
  protected endpoint: string;

  async validate(endpoint: string) {
    this.endpoint = endpoint;
    await Promise.all(this.actions.map((action) => action()));
  }

  getEndpointKeys(): string[] {
    throw new Error('Method not implemented.');
  }
  withChainId(chainId: string): IRpcFamily {
    throw new Error('Method not implemented.');
  }
  withGenesisHash(genesisHash: string): IRpcFamily {
    throw new Error('Method not implemented.');
  }
  withNodeType(nodeType: string): IRpcFamily {
    throw new Error('Method not implemented.');
  }
  withClientNameAndVersion(clientName: string, clientVersion: string): IRpcFamily {
    throw new Error('Method not implemented.');
  }
  withClientVersion(clientVersion: string): IRpcFamily {
    throw new Error('Method not implemented.');
  }
  getStartHeight(endpoint: string): Promise<number> {
    throw new Error('Method not implemented.');
  }
  getTargetHeight(endpoint: string): Promise<number> {
    throw new Error('Method not implemented.');
  }
  getLastHeight(endpoint: string): Promise<number> {
    throw new Error('Method not implemented.');
  }
  getLastTimestamp(endpoint: string): Promise<number> {
    throw new Error('Method not implemented.');
  }
}

export class RpcFamilyEvm extends RpcFamily {
  getEndpointKeys(): string[] {
    return ['evmWs', 'evmHttp'];
  }

  withChainId(chainId: string): IRpcFamily {
    this.actions.push(async () => {
      const result = await jsonRpcRequest(this.endpoint, 'eth_chainId', []);
      if (result.data.error) {
        throw new Error(`Request eth_chainId failed: ${result.data.error.message}`);
      }
      const chainIdFromRpc = result.data.result;
      if (!BigNumber.from(chainIdFromRpc).eq(BigNumber.from(chainId))) {
        throw new Error(
          `ChainId mismatch: ${BigNumber.from(chainIdFromRpc).toString()} != ${BigNumber.from(
            chainId
          ).toString()}`
        );
      }
    });
    return this;
  }

  withGenesisHash(genesisHash: string): IRpcFamily {
    this.actions.push(async () => {
      const result = await jsonRpcRequest(this.endpoint, 'eth_getBlockByNumber', ['0x0', false]);
      if (result.data.error) {
        throw new Error(`Request eth_getBlockByNumber failed: ${result.data.error.message}`);
      }
      const genesisHashFromRpc = result.data.result.hash;
      if (!BigNumber.from(genesisHashFromRpc).eq(BigNumber.from(genesisHash))) {
        throw new Error(`GenesisHash mismatch: ${genesisHashFromRpc} != ${genesisHash}`);
      }
    });
    return this;
  }

  withNodeType(nodeType: string): IRpcFamily {
    this.actions.push(async () => {
      const result = await jsonRpcRequest(this.endpoint, 'eth_getBalance', [
        '0x0000000000000000000000000000000000000000',
        'latest',
      ]);
      let nodeTypeFromRpc: string;
      if (result.data.error) {
        logger.debug(`Request eth_getBalance failed: ${result.data.error.message}`);
        nodeTypeFromRpc = 'full';
      } else {
        nodeTypeFromRpc = 'archive';
      }
      if (nodeTypeFromRpc === 'full' && _.toLower(nodeType) === 'archive') {
        throw new Error(`NodeType mismatch: ${nodeTypeFromRpc} != ${nodeType}`);
      }
    });
    return this;
  }

  withClientNameAndVersion(clientName: string, clientVersion: string): IRpcFamily {
    this.actions.push(async () => {
      const result = await jsonRpcRequest(this.endpoint, 'web3_clientVersion', []);
      if (result.data.error) {
        throw new Error(`Request web3_clientVersion failed: ${result.data.error.message}`);
      }
      const resultSet = result.data.result.split('/');
      const clientNameFromRpc = resultSet[0];
      const clientVersionFromRpc = resultSet[1];
      if (!_.eq(_.toLower(clientNameFromRpc), _.toLower(clientName))) {
        throw new Error(`ClientName mismatch: ${clientNameFromRpc} != ${clientName}`);
      }
      if (!semver.satisfies(semver.coerce(clientVersionFromRpc), clientVersion)) {
        throw new Error(`ClientVersion mismatch: ${clientVersionFromRpc} vs ${clientVersion}`);
      }
    });
    return this;
  }

  async getStartHeight(endpoint: string): Promise<number> {
    const result = await jsonRpcRequest(endpoint, 'eth_syncing', []);
    if (result.data.error) {
      throw new Error(`Request eth_syncing failed: ${result.data.error.message}`);
    }
    if (result.data.result === false) {
      return 0;
    }
    // rpc's start block from latest startup, useless at this moment
    return BigNumber.from(result.data.result.startingBlock).toNumber();
  }

  async getTargetHeight(endpoint: string): Promise<number> {
    const result = await jsonRpcRequest(endpoint, 'eth_syncing', []);
    if (result.data.error) {
      throw new Error(`Request eth_syncing failed: ${result.data.error.message}`);
    }
    if (result.data.result === false) {
      return 0;
    }
    return BigNumber.from(result.data.result.highestBlock).toNumber();
  }

  async getLastHeight(endpoint: string): Promise<number> {
    let result = await jsonRpcRequest(endpoint, 'eth_syncing', []);
    if (result.data.error) {
      throw new Error(`Request eth_syncing failed: ${result.data.error.message}`);
    }
    if (result.data.result !== false) {
      return BigNumber.from(result.data.result.currentBlock).toNumber();
    }
    result = await jsonRpcRequest(endpoint, 'eth_blockNumber', []);
    if (result.data.error) {
      throw new Error(`Request eth_blockNumber failed: ${result.data.error.message}`);
    }
    return BigNumber.from(result.data.result).toNumber();
  }

  async getLastTimestamp(endpoint: string): Promise<number> {
    const result = await jsonRpcRequest(endpoint, 'eth_getBlockByNumber', ['latest', false]);
    if (result.data.error) {
      throw new Error(`Request eth_getBlockByNumber failed: ${result.data.error.message}`);
    }
    return BigNumber.from(result.data.result.timestamp).toNumber();
  }
}

export class RpcFamilySubstrate extends RpcFamilyEvm {
  getEndpointKeys(): string[] {
    return ['substrateWs', 'substrateHttp'];
  }
}
