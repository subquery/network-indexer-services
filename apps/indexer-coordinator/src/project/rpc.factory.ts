import axios from 'axios';
import { BigNumber } from 'ethers';
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
}

abstract class RpcFamily implements IRpcFamily {
  protected actions: (() => void)[] = [];
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
      if (nodeTypeFromRpc !== nodeType) {
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
      if (clientNameFromRpc !== clientName) {
        throw new Error(`ClientName mismatch: ${clientNameFromRpc} != ${clientName}`);
      }
      if (clientVersionFromRpc !== clientVersion) {
        throw new Error(`ClientVersion mismatch: ${clientVersionFromRpc} != ${clientVersion}`);
      }
    });
    return this;
  }
}

export class RpcFamilySubstrate extends RpcFamilyEvm {
  getEndpointKeys(): string[] {
    return ['substrateWs', 'substrateHttp'];
  }
}
