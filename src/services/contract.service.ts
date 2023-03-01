// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { ChainID } from './../utils/contractSDK';
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { isValidPrivate, toBuffer } from 'ethereumjs-util';
import { Wallet, utils, providers } from 'ethers';
import { isEmpty } from 'lodash';
import { formatUnits } from '@ethersproject/units';
import { ContractSDK, ERC20__factory } from '@subql/contract-sdk';
import { SQToken } from '@subql/contract-sdk/publish/testnet.json';
import { cidToBytes32 } from '@subql/network-clients';

import { AccountService } from 'src/account/account.service';
import { Config } from 'src/configure/configure.module';
import { initContractSDK, networkToChainID } from 'src/utils/contractSDK';
import { decrypt } from 'src/utils/encrypt';
import { getLogger } from 'src/utils/logger';

import { DeploymentStatus, IndexingStatus } from './types';

// TODO: move contract service to a separate moduel

@Injectable()
export class ContractService {
  private wallet: Wallet;
  private sdk: ContractSDK;
  private provider: providers.StaticJsonRpcProvider;
  private emptyDeploymentStatus;
  private chainID: string;
  private existentialBalance: number;

  constructor(
    // TODO: resolve the cycle dependency between `accountService` and `contractService`
    @Inject(forwardRef(() => AccountService)) private accountService: AccountService,
    private config: Config,
  ) {
    this.chainID = networkToChainID[config.network];
    this.emptyDeploymentStatus = { status: IndexingStatus.NOTINDEXING, blockHeight: 0 };
    this.existentialBalance = 0.2;
    this.initProvider(config.wsEndpoint);
  }

  getSdk() {
    return this.sdk;
  }

  initProvider(endpoint: string) {
    this.provider = new providers.StaticJsonRpcProvider(endpoint, parseInt(this.chainID, 16));
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

  async getLastBlockNumber() {
    return await this.provider.getBlockNumber();
  }

  async hasSufficientBalance() {
    try {
      const balance = await this.wallet.getBalance();
      const value = Number(formatUnits(balance, 18));
      return value > this.existentialBalance;
    } catch {
      return false;
    }
  }

  async isEmpytAccount(account: string) {
    try {
      const balance = await this.provider.getBalance(account);
      // TODO: should comparing with a small amount other than 0
      return balance.eq(0);
    } catch {
      return false;
    }
  }

  async withdrawAll(id: string): Promise<boolean> {
    try {
      const indexer = await this.accountService.getIndexer();
      const account = await this.accountService.getAccount(id);
      if (!account) {
        getLogger('contract').warn(`Account: ${id} not exist`);
        return;
      }

      const pk = decrypt(account.controller);
      const wallet = new Wallet(toBuffer(pk), this.provider);

      // send SQT
      const sqtToken = ERC20__factory.connect(SQToken.address, wallet);
      const sqtBalance = await sqtToken.balanceOf(wallet.address);
      if (!sqtBalance.eq(0)) {
        const tx = await sqtToken.transfer(indexer, sqtBalance);
        await tx.wait(1);
      }

      // send ACA
      const balance = await this.provider.getBalance(wallet.address);
      const value = balance.sub(utils.parseEther('0.1'));
      const res = await wallet.sendTransaction({ to: indexer, value });
      await res.wait(1);

      getLogger('contract').info(`Transfer all funds from controller to indexer successfully`);

      return true;
    } catch (e) {
      getLogger('contract').warn(`Fail to transfer all funds from controller to indexer ${e}`);
      return false;
    }
  }

  isValidPrivateKey(key: string) {
    return key.startsWith('0x') && isValidPrivate(toBuffer(key));
  }

  async indexerToController(indexer: string) {
    const controller = await this.sdk.indexerRegistry.getController(indexer);
    return controller ? controller.toLowerCase() : '';
  }

  async createSDK(key: string) {
    const keyBuffer = toBuffer(key);
    this.wallet = new Wallet(keyBuffer, this.provider);
    this.sdk = await initContractSDK(this.wallet, this.chainID as ChainID);
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

    // TODO: move to account repo
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
    validAccounts.forEach(async ({ controllerKey }) => {
      try {
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
        cidToBytes32(id.trim()),
        indexer,
      );
      return { status, blockHeight };
    } catch (e) {
      getLogger('contract').error(`failed to get indexing status for project: ${id} ${e}`);
      return this.emptyDeploymentStatus;
    }
  }
}
