// Copyright 2020-2021 OnFinality Limited authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { isValidPrivate, toBuffer } from 'ethereumjs-util';
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
  private accountID: string;
  private currentController: string;
  private provider: JsonRpcProvider;
  private chainID: number;
  private sdk: ContractSDK;

  constructor(private accountService: AccountService, private config: Config) {
    const ws = this.config.wsEndpoint;
    this.chainID = chainIds[this.config.network];
    this.provider = new ethers.providers.StaticJsonRpcProvider(ws, this.chainID);
  }

  getWallet() {
    return this.wallet;
  }

  getSdk() {
    return this.sdk;
  }

  isWalletValid() {
    return this.wallet?.address.toLowerCase() === this.currentController;
  }

  async updateContractSDK() {
    const accounts = await this.accountService.getAccounts();
    if (isEmpty(accounts)) return;

    const indexer = await this.accountService.getIndexer();
    if (indexer && this.wallet && this.sdk) {
      this.currentController = (
        await this.sdk.indexerRegistry.indexerToController(indexer)
      ).toLowerCase();
      if (this.isWalletValid()) return;

      this.accountService.deleteAccount(this.accountID);
      this.wallet = undefined;
      this.sdk = undefined;
      this.accountID = undefined;
    }

    accounts.forEach(async ({ id, indexer, controller: encryptedController }) => {
      const controller = decrypt(encryptedController);
      if (
        isEmpty(controller) ||
        !controller.startsWith('0x') ||
        !isValidPrivate(toBuffer(controller))
      )
        return;

      try {
        const controllerBuff = toBuffer(controller);
        const wallet = new Wallet(controllerBuff, this.provider);
        const sdk = await initContractSDK(wallet, this.chainID);
        this.currentController = (
          await sdk.indexerRegistry.indexerToController(indexer)
        ).toLowerCase();

        if (wallet.address.toLowerCase() === this.currentController) {
          this.accountID = id;
          this.wallet = wallet;
          this.sdk = sdk;
        }
      } catch (e) {
        getLogger('report').error(e, 'init contract sdk failed');
        return;
      }
    });
  }

  async deploymentStatusByIndexer(id: string): Promise<IndexingStatus> {
    const indexer = await this.accountService.getIndexer();
    if (!this.sdk || !indexer) return IndexingStatus.NOTSTART;

    const { status } = await this.sdk.queryRegistry.deploymentStatusByIndexer(
      cidToBytes32(id),
      indexer,
    );
    return status as IndexingStatus;
  }
}
