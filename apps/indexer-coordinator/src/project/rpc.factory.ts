// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import axios from 'axios';
import { BigNumber } from 'ethers';
import _ from 'lodash';
import * as semver from 'semver';
import { getLogger } from 'src/utils/logger';
import { WebSocket } from 'ws';

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

export enum RequiredRpcType {
  any = 'any',
  http = 'http',
  ws = 'ws',
  both = 'both',
}

function jsonRpcRequest(endpoint: string, method: string, params: any[]): Promise<any> {
  if (!endpoint) {
    return Promise.reject(new Error('Endpoint is empty'));
  }
  if (!endpoint.startsWith('http://') && !endpoint.startsWith('https://')) {
    return Promise.reject(new Error('Invalid http endpoint'));
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

async function jsonWsRpcRequest(endpoint: string, method: string, params: any[]): Promise<any> {
  if (!endpoint) {
    throw new Error('Endpoint is empty');
  }
  if (!endpoint.startsWith('ws://') && !endpoint.startsWith('wss://')) {
    throw new Error('Invalid ws endpoint');
  }
  const ws = new WebSocket(endpoint);
  try {
    return await Promise.race([
      new Promise((resolve, reject) => {
        ws.onopen = function open() {
          ws.send(
            JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method,
              params,
            })
          );
        };
        ws.onmessage = function incoming(message) {
          resolve({ data: JSON.parse(message.data.toString()) });
        };
        ws.onerror = function (error) {
          reject(error.error);
        };
      }),
      new Promise((_, reject_1) => {
        setTimeout(() => {
          reject_1(new Error('Ws request timeout'));
        }, 10000);
      }),
    ]);
  } finally {
    ws.terminate();
  }
}

function getRpcRequestFunction(endpoint: string) {
  if (endpoint.startsWith('ws://') || endpoint.startsWith('wss://')) {
    return jsonWsRpcRequest;
  } else if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return jsonRpcRequest;
  } else {
    throw new Error('Invalid endpoint');
  }
}

export interface IRpcFamily {
  getEndpointKeys(): string[];
  getRequiredRpcType(): RequiredRpcType;
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
  protected requiredRpcType: RequiredRpcType = RequiredRpcType.any;

  async validate(endpoint: string) {
    this.endpoint = endpoint;
    await Promise.all(this.actions.map((action) => action()));
  }
  getEndpointKeys(): string[] {
    throw new Error('Method not implemented.');
  }
  getRequiredRpcType(): RequiredRpcType {
    return this.requiredRpcType;
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
      const result = await getRpcRequestFunction(this.endpoint)(this.endpoint, 'eth_chainId', []);
      if (result.data.error) {
        throw new Error(`Request eth_chainId failed: ${result.data.error.message}`);
      }
      const chainIdFromRpc = result.data.result;
      if (!BigNumber.from(chainIdFromRpc).eq(BigNumber.from(chainId || 0))) {
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
      const result = await getRpcRequestFunction(this.endpoint)(
        this.endpoint,
        'eth_getBlockByNumber',
        ['0x0', false]
      );
      if (result.data.error) {
        throw new Error(`Request eth_getBlockByNumber failed: ${result.data.error.message}`);
      }
      const genesisHashFromRpc = result.data.result.hash;
      if (
        !!genesisHash &&
        !BigNumber.from(genesisHashFromRpc).eq(BigNumber.from(genesisHash || 0))
      ) {
        throw new Error(`GenesisHash mismatch: ${genesisHashFromRpc} != ${genesisHash}`);
      }
    });
    return this;
  }

  withNodeType(nodeType: string): IRpcFamily {
    this.actions.push(async () => {
      const result = await getRpcRequestFunction(this.endpoint)(this.endpoint, 'eth_getBalance', [
        '0x0000000000000000000000000000000000000000',
        '0x1',
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
      if (!clientName && !clientVersion) {
        return;
      }
      const result = await getRpcRequestFunction(this.endpoint)(
        this.endpoint,
        'web3_clientVersion',
        []
      );
      if (result.data.error) {
        throw new Error(`Request web3_clientVersion failed: ${result.data.error.message}`);
      }
      const resultSet = result.data.result.split('/');
      const clientNameFromRpc = resultSet[0];
      const clientVersionFromRpc = resultSet[1];
      if (!!clientName && !_.eq(_.toLower(clientNameFromRpc), _.toLower(clientName))) {
        throw new Error(`ClientName mismatch: ${clientNameFromRpc} != ${clientName}`);
      }
      if (
        !!clientVersion &&
        !semver.satisfies(semver.coerce(clientVersionFromRpc), clientVersion)
      ) {
        throw new Error(`ClientVersion mismatch: ${clientVersionFromRpc} vs ${clientVersion}`);
      }
    });
    return this;
  }

  async getStartHeight(endpoint: string): Promise<number> {
    const result = await getRpcRequestFunction(this.endpoint)(endpoint, 'eth_syncing', []);
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
    const result = await getRpcRequestFunction(this.endpoint)(endpoint, 'eth_syncing', []);
    if (result.data.error) {
      throw new Error(`Request eth_syncing failed: ${result.data.error.message}`);
    }
    if (result.data.result === false) {
      return 0;
    }
    return BigNumber.from(result.data.result.highestBlock).toNumber();
  }

  async getLastHeight(endpoint: string): Promise<number> {
    let result = await getRpcRequestFunction(this.endpoint)(endpoint, 'eth_syncing', []);
    if (result.data.error) {
      throw new Error(`Request eth_syncing failed: ${result.data.error.message}`);
    }
    if (result.data.result !== false) {
      return BigNumber.from(result.data.result.currentBlock).toNumber();
    }
    result = await getRpcRequestFunction(this.endpoint)(endpoint, 'eth_blockNumber', []);
    if (result.data.error) {
      throw new Error(`Request eth_blockNumber failed: ${result.data.error.message}`);
    }
    return BigNumber.from(result.data.result).toNumber();
  }

  async getLastTimestamp(endpoint: string): Promise<number> {
    const result = await getRpcRequestFunction(this.endpoint)(endpoint, 'eth_getBlockByNumber', [
      'latest',
      false,
    ]);
    if (result.data.error) {
      throw new Error(`Request eth_getBlockByNumber failed: ${result.data.error.message}`);
    }
    return BigNumber.from(result.data.result.timestamp).toNumber();
  }
}

export class RpcFamilySubstrate extends RpcFamily {
  startHeight: number;
  targetHeight: number;
  lastHeight: number;
  lastTimestamp: number;

  constructor() {
    super();
    this.requiredRpcType = RequiredRpcType.ws;
  }

  getEndpointKeys(): string[] {
    return ['substrateWs', 'substrateHttp'];
  }

  withChainId(chainId: string): IRpcFamily {
    return this;
  }

  withGenesisHash(genesisHash: string): IRpcFamily {
    this.actions.push(async () => {
      const result = await getRpcRequestFunction(this.endpoint)(
        this.endpoint,
        'chain_getBlockHash',
        [0]
      );
      if (result.data.error) {
        throw new Error(`Request chain_getBlockHash failed: ${result.data.error.message}`);
      }
      const genesisHashFromRpc = result.data.result;
      if (
        !!genesisHash &&
        !BigNumber.from(genesisHashFromRpc).eq(BigNumber.from(genesisHash || 0))
      ) {
        throw new Error(`GenesisHash mismatch: ${genesisHashFromRpc} != ${genesisHash}`);
      }
    });
    return this;
  }

  withNodeType(nodeType: string): IRpcFamily {
    this.actions.push(async () => {
      const result = await getRpcRequestFunction(this.endpoint)(
        this.endpoint,
        'state_getRuntimeVersion',
        ['0x2d7cfacc14a1603ea1dbb207ae07516224d25fff5310058d1c371f2acac5143e']
      );
      let nodeTypeFromRpc: string;
      if (result.data.error) {
        logger.debug(`Request state_getRuntimeVersion failed: ${result.data.error.message}`);
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
    return this;
  }

  withClientVersion(clientVersion: string): IRpcFamily {
    return this;
  }

  async getStartHeight(endpoint: string): Promise<number> {
    if (this.startHeight) {
      return Promise.resolve(this.startHeight);
    }
    await this.getHeights(endpoint);
    return this.startHeight;
  }

  async getTargetHeight(endpoint: string): Promise<number> {
    if (this.targetHeight) {
      return Promise.resolve(this.targetHeight);
    }
    await this.getHeights(endpoint);
    return this.targetHeight;
  }

  async getLastHeight(endpoint: string): Promise<number> {
    if (this.lastHeight) {
      return Promise.resolve(this.lastHeight);
    }
    await this.getHeights(endpoint);
    return this.lastHeight;
  }

  async getHeights(endpoint: string): Promise<void> {
    const result = await getRpcRequestFunction(this.endpoint)(endpoint, 'system_syncState', []);
    if (result.error) {
      throw new Error(`Request system_syncState failed: ${result.error.message}`);
    }
    this.startHeight = result.data.result.startingBlock;
    this.targetHeight = result.data.result.currentBlock;
    this.lastHeight = result.data.result.currentBlock;
  }

  async getLastTimestamp(endpoint: string): Promise<number> {
    if (this.lastTimestamp) {
      return Promise.resolve(this.lastTimestamp);
    }
    return Promise.resolve(0);
  }
}
