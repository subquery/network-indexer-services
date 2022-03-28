// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { bufferToHex, isValidPrivate, privateToAddress, toBuffer } from 'ethereumjs-util';
import { Wallet, ethers } from 'ethers';
import { isEmpty } from 'lodash';
import { JsonRpcProvider } from '@ethersproject/providers';
import { ContractSDK } from '@subql/contract-sdk';
import { AccountService } from 'src/account/account.service';
import { chainIds, cidToBytes32, initContractSDK } from 'src/utils/contractSDK';
import { decrypt } from '../utils/encrypto';
import { Config } from '../configure/configure.module';
import { IndexingStatus } from './types';
import { getLogger } from 'src/utils/logger';

@Injectable()
export class ContractService {
  private wallet: Wallet;
  private provider: JsonRpcProvider;
  private chainID: number;
  private sdk: ContractSDK;

  constructor(private accountService: AccountService, private config: Config) {
    const ws = this.config.wsEndpoint;
    this.chainID = chainIds[this.config.network];
    this.provider = new ethers.providers.StaticJsonRpcProvider(ws, this.chainID);
  }

  getSdk() {
    return this.sdk;
  }

  async getBlockTime() {
    const blockNumber = await this.provider.getBlockNumber();
    const block = await this.provider.getBlock(blockNumber);
    return block.timestamp;
  }

  isPrivateKeyValid(key: string) {
    return key.startsWith('0x') && isValidPrivate(toBuffer(key));
  }

  async indexerToController(indexer: string) {
    const controller = await this.sdk.indexerRegistry.indexerToController(indexer);
    return controller ? controller.toLowerCase() : '';
  }

  async createSDK(key: string) {
    const keyBuffer = toBuffer(key);
    this.wallet = new Wallet(keyBuffer, this.provider);
    this.sdk = await initContractSDK(this.wallet, this.chainID);
  }

  async updateContractSDK() {
    const accounts = await this.accountService.getAccounts();
    if (isEmpty(accounts)) return;

    // check current sdk signer is same with the controller account on network
    const indexer = await this.accountService.getIndexer();
    if (indexer && this.wallet && this.sdk) {
      const controller = await this.indexerToController(indexer);
      if (this.wallet.address.toLowerCase() === controller) return;
    }

    const validAccounts = accounts
      .map(({ id, controller }) => ({ id, controllerKey: decrypt(controller) }))
      .filter(async ({ controllerKey }) => this.isPrivateKeyValid(controllerKey));

    if (!this.sdk) {
      await this.createSDK(validAccounts[0].controllerKey);
    }

    const controller = await this.indexerToController(indexer);
    accounts.forEach(async ({ id, controller: controllerKey }) => {
      try {
        if (isEmpty(controllerKey)) return;
        const keyBuffer = toBuffer(decrypt(controllerKey));
        const controllerAddress = bufferToHex(privateToAddress(keyBuffer)).toLowerCase();
        if (controllerAddress !== controller) {
          await this.accountService.deleteAccount(id);
          return;
        }

        if (this.wallet.address.toLowerCase() !== controller) {
          await this.createSDK(controllerKey);
        }
      } catch (e) {
        getLogger('contract').error(`Init contract sdk failed: ${e}`);
      }
    });
  }

  async deploymentStatusByIndexer(id: string): Promise<IndexingStatus> {
    const indexer = await this.accountService.getIndexer();
    if (!this.sdk || !indexer) return IndexingStatus.NOTINDEXING;

    const { status } = await this.sdk.queryRegistry.deploymentStatusByIndexer(
      cidToBytes32(id),
      indexer,
    );
    return status as IndexingStatus;
  }
}
