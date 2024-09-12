// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import axios from 'axios';
import { BigNumber } from 'ethers';
import _ from 'lodash';
import * as semver from 'semver';
import { safeJSONParse } from 'src/utils/json';
import { getLogger } from 'src/utils/logger';
import { WebSocket } from 'ws';
import { ENDPOINT_KEY, ErrorLevel, ValidateRpcEndpointError } from './types';

const logger = getLogger('rpc.factory');

export function getRpcFamilyObject(rpcFamily: string): IRpcFamily | undefined {
  let family: IRpcFamily;
  switch (rpcFamily) {
    case 'evm':
      family = new RpcFamilyEvm();
      break;
    case 'substrate':
      family = new RpcFamilyPolkadot();
      break;
    case 'polkadot':
      family = new RpcFamilyPolkadot();
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

async function jsonMetricsHttpRpcRequest(endpoint: string) {
  if (!endpoint) {
    throw new Error('Endpoint is empty');
  }
  return axios.request({
    url: endpoint,
    method: 'get',
    timeout: 1000 * 10,
  });
}

function getRpcRequestFunction(endpoint: string) {
  if (!endpoint) {
    throw new Error('Endpoint is empty');
  }
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
  validate(endpoint: string, endpointKey: ENDPOINT_KEY): Promise<void>;
  getStartHeight(endpoint: string): Promise<number>;
  getTargetHeight(endpoint: string): Promise<number>;
  getLastHeight(endpoint: string): Promise<number>;
  getLastTimestamp(endpoint: string): Promise<number>;
}

abstract class RpcFamily implements IRpcFamily {
  protected actions: (() => Promise<any>)[] = [];
  protected endpoint: string;
  protected requiredRpcType: RequiredRpcType = RequiredRpcType.http;
  protected targetEndpointKey: ENDPOINT_KEY;

  async validate(endpoint: string, endpointKey: ENDPOINT_KEY) {
    this.endpoint = endpoint;
    this.targetEndpointKey = endpointKey;
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
    return [ENDPOINT_KEY.evmWs, ENDPOINT_KEY.evmHttp, ENDPOINT_KEY.evmMetricsHttp];
  }

  withChainId(chainId: string): IRpcFamily {
    this.actions.push(async () => {
      let p = null;
      let errorLevel = ErrorLevel.error;
      switch (this.targetEndpointKey) {
        case ENDPOINT_KEY.evmHttp:
          p = jsonRpcRequest(this.endpoint, 'eth_chainId', []);
          break;
        case ENDPOINT_KEY.evmWs:
          p = jsonWsRpcRequest(this.endpoint, 'eth_chainId', []);
          break;
        case ENDPOINT_KEY.evmMetricsHttp:
          p = jsonMetricsHttpRpcRequest(this.endpoint);
          errorLevel = ErrorLevel.warn;
          break;
        default:
          throw new ValidateRpcEndpointError('Invalid endpointKey', errorLevel);
      }
      const result = await p;
      if (result.data.error) {
        throw new ValidateRpcEndpointError(
          `Request eth_chainId failed: ${result.data.error.message}`,
          errorLevel
        );
      }
      let chainIdFromRpc = result.data.result;
      if (this.targetEndpointKey === ENDPOINT_KEY.evmMetricsHttp) {
        const info = safeJSONParse(result.data['chain/info']);
        chainIdFromRpc = info?.chain_id;
      }

      if (!BigNumber.from(chainIdFromRpc).eq(BigNumber.from(chainId || 0))) {
        throw new ValidateRpcEndpointError(
          `ChainId mismatch: ${BigNumber.from(chainIdFromRpc).toString()} != ${BigNumber.from(
            chainId
          ).toString()}`,
          errorLevel
        );
      }
    });
    return this;
  }

  withGenesisHash(genesisHash: string): IRpcFamily {
    this.actions.push(async () => {
      if (this.targetEndpointKey === ENDPOINT_KEY.evmMetricsHttp) {
        return;
      }

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
      if (this.targetEndpointKey === ENDPOINT_KEY.evmMetricsHttp) {
        return;
      }
      const result = await getRpcRequestFunction(this.endpoint)(this.endpoint, 'eth_getBalance', [
        '0x0000000000000000000000000000000000000000',
        _.toLower(nodeType) === 'archive' ? '0x1' : 'latest',
      ]);
      if (result.data.error) {
        throw new Error(`NodeType mismatch: ${nodeType} required`);
      }
    });
    return this;
  }

  withClientNameAndVersion(clientName: string, clientVersion: string): IRpcFamily {
    this.actions.push(async () => {
      if (!clientName && !clientVersion) {
        return;
      }
      if (this.targetEndpointKey === ENDPOINT_KEY.evmMetricsHttp) {
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
    const result = await getRpcRequestFunction(endpoint)(endpoint, 'eth_syncing', []);
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
    const result = await getRpcRequestFunction(endpoint)(endpoint, 'eth_syncing', []);
    if (result.data.error) {
      throw new Error(`Request eth_syncing failed: ${result.data.error.message}`);
    }
    if (result.data.result === false) {
      return 0;
    }
    return BigNumber.from(result.data.result.highestBlock).toNumber();
  }

  async getLastHeight(endpoint: string): Promise<number> {
    let result = await getRpcRequestFunction(endpoint)(endpoint, 'eth_syncing', []);
    if (result.data.error) {
      throw new Error(`Request eth_syncing failed: ${result.data.error.message}`);
    }
    if (result.data.result !== false) {
      return BigNumber.from(result.data.result.currentBlock).toNumber();
    }
    result = await getRpcRequestFunction(endpoint)(endpoint, 'eth_blockNumber', []);
    if (result.data.error) {
      throw new Error(`Request eth_blockNumber failed: ${result.data.error.message}`);
    }
    return BigNumber.from(result.data.result).toNumber();
  }

  async getLastTimestamp(endpoint: string): Promise<number> {
    const result = await getRpcRequestFunction(endpoint)(endpoint, 'eth_getBlockByNumber', [
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
  startHeight = 0;
  targetHeight = 0;
  lastHeight = 0;
  lastTimestamp = 0;

  constructor() {
    super();
    this.requiredRpcType = RequiredRpcType.both;
  }

  getEndpointKeys(): string[] {
    return [ENDPOINT_KEY.substrateWs, ENDPOINT_KEY.substrateHttp];
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
      if (_.toLower(nodeType) !== 'archive') {
        return;
      }
      const result = await getRpcRequestFunction(this.endpoint)(
        this.endpoint,
        'chain_getBlockHash',
        [0]
      );
      if (result.data.error) {
        throw new Error(`Request chain_getBlockHash failed: ${result.data.error.message}`);
      }
      const genesisHashFromRpc = result.data.result;
      const result2 = await getRpcRequestFunction(this.endpoint)(
        this.endpoint,
        'state_getRuntimeVersion',
        [genesisHashFromRpc]
      );
      if (result2.data.error) {
        logger.debug(`Request state_getRuntimeVersion failed: ${result2.data.error.message}`);
        throw new Error(`NodeType mismatch: ${nodeType} required`);
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
    if (!endpoint) {
      logger.debug('getHeights: endpoint is empty');
      return;
    }
    const result = await getRpcRequestFunction(endpoint)(endpoint, 'system_syncState', []);
    if (result.error) {
      throw new Error(`Request system_syncState failed: ${result.error.message}`);
    }
    this.startHeight = result.data.result.startingBlock;
    this.targetHeight = result.data.result.highestBlock;
    this.lastHeight = result.data.result.currentBlock;
  }

  async getLastTimestamp(endpoint: string): Promise<number> {
    if (this.lastTimestamp) {
      return Promise.resolve(this.lastTimestamp);
    }
    return Promise.resolve(0);
  }
}

export class RpcFamilyPolkadot extends RpcFamilySubstrate {
  getEndpointKeys(): string[] {
    return [ENDPOINT_KEY.polkadotWs, ENDPOINT_KEY.polkadotHttp, ENDPOINT_KEY.polkadotMetricsHttp];
  }

  withGenesisHash(genesisHash: string): IRpcFamily {
    if (this.targetEndpointKey === ENDPOINT_KEY.polkadotMetricsHttp) {
      return this;
    }
    return super.withGenesisHash(genesisHash);
  }

  withNodeType(nodeType: string): IRpcFamily {
    if (this.targetEndpointKey === ENDPOINT_KEY.polkadotMetricsHttp) {
      return this;
    }
    return super.withNodeType(nodeType);
  }
}
