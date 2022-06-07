// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { bufferToHex, isValidPrivate, privateToAddress, toBuffer } from 'ethereumjs-util';
import { Wallet } from 'ethers';
import { isEmpty } from 'lodash';
import { formatUnits } from '@ethersproject/units';
import { ContractSDK } from '@subql/contract-sdk';
import { EvmRpcProvider } from '@acala-network/eth-providers';

import { AccountService } from 'src/account/account.service';
import { Config } from 'src/configure/configure.module';
import { chainIds, cidToBytes32, initContractSDK, substrateUrl } from 'src/utils/contractSDK';
import { decrypt } from 'src/utils/encrypt';
import { getLogger } from 'src/utils/logger';

import { DeploymentStatus, IndexingStatus } from './types';

@Injectable()
export class ContractService {
  private wallet: Wallet;
  private provider: EvmRpcProvider;
  private chainID: number;
  private sdk: ContractSDK;
  private emptyDeploymentStatus;
  private existentialBalance: number;

  constructor(private accountService: AccountService, private config: Config) {
    this.chainID = chainIds[this.config.network];
    this.provider = EvmRpcProvider.from(substrateUrl);
    this.emptyDeploymentStatus = { status: IndexingStatus.NOTINDEXING, blockHeight: 0 };
    this.existentialBalance = 0.1;
  }

  getSdk() {
    return this.sdk;
  }

  async getBlockTime() {
    try {
      const blockNumber = await this.provider.getBlockNumber();
      const block = await this.provider.getBlock(blockNumber);
      return block.timestamp;
    } catch {
      return Math.floor((new Date().getTime() - 60000) / 1000);
    }
  }

  async getBalance() {
    const balance = await this.wallet.getBalance();
    return Number(formatUnits(balance, 18));
  }

  async hasSufficientBalance() {
    try {
      const balance = await this.getBalance();
      return balance > this.existentialBalance;
    } catch {
      return false;
    }
  }

  isValidPrivateKey(key: string) {
    return key.startsWith('0x') && isValidPrivate(toBuffer(key));
  }

  privateToAdress(key: string) {
    return bufferToHex(privateToAddress(toBuffer(key))).toLowerCase();
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
      .filter(({ controllerKey }) => this.isValidPrivateKey(controllerKey));

    if (isEmpty(validAccounts)) {
      getLogger('contract').warn('no valid controller account config in service');
      return;
    }

    if (!this.sdk) {
      const key = validAccounts[0].controllerKey;
      if (!key) getLogger('contract').error('controller key can not be empty');
      if (key) await this.createSDK(key);
    }

    const controller = await this.indexerToController(indexer);
    validAccounts.forEach(async ({ id, controllerKey }) => {
      try {
        const controllerAddress = this.privateToAdress(controllerKey);
        if (controllerAddress !== controller) {
          getLogger('contract').info(`remove invalid controller account: ${controllerAddress}`);
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

  async deploymentStatusByIndexer(id: string): Promise<DeploymentStatus> {
    const indexer = await this.accountService.getIndexer();
    if (!this.sdk || !indexer) return this.emptyDeploymentStatus;

    try {
      const { status, blockHeight } = await this.sdk.queryRegistry.deploymentStatusByIndexer(
        cidToBytes32(id),
        indexer,
      );
      return { status, blockHeight };
    } catch {
      getLogger('contract').error(`failed to get indexing status for project: ${id}`);
      return this.emptyDeploymentStatus;
    }
  }
}
