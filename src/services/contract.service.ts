// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { ChainID } from './../utils/contractSDK';
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { isValidPrivate, toBuffer } from 'ethereumjs-util';
import { Wallet, providers } from 'ethers';
import { isEmpty } from 'lodash';
import { ContractSDK } from '@subql/contract-sdk';
import { cidToBytes32 } from '@subql/network-clients';

import { AccountService } from 'src/account/account.service';
import { Config } from 'src/configure/configure.module';
import { initContractSDK, networkToChainID } from 'src/utils/contractSDK';
import { decrypt } from 'src/utils/encrypt';
import { debugLogger, getLogger } from 'src/utils/logger';

import { DeploymentStatus, IndexingStatus } from './types';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Controller } from 'src/account/account.model';

@Injectable()
export class ContractService {
  private wallet: Wallet;
  private sdk: ContractSDK;
  private provider: providers.StaticJsonRpcProvider;
  private emptyDeploymentStatus;
  private chainID: ChainID;
  private existentialBalance: BigNumber;

  constructor(
    @Inject(forwardRef(() => AccountService)) private accountService: AccountService,
    @InjectRepository(Controller) private controllerRepo: Repository<Controller>,
    private config: Config,
  ) {
    this.chainID = networkToChainID[config.network];
    this.emptyDeploymentStatus = { status: IndexingStatus.NOTINDEXING, blockHeight: 0 };
    this.existentialBalance = parseEther('0.05');
    this.initProvider(config.wsEndpoint);
    this.sdk = initContractSDK(this.provider, this.chainID);
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
      return balance.gte(this.existentialBalance);
    } catch {
      return false;
    }
  }

  async isEmpytAccount(account: string) {
    try {
      const balance = await this.provider.getBalance(account);
      return balance.eq(0);
    } catch {
      return false;
    }
  }

  async withdrawAll(id: string): Promise<boolean> {
    try {
      const indexer = await this.accountService.getIndexer();
      const controller = await this.accountService.getController(id);
      if (!controller) {
        getLogger('contract').warn(`Controller: ${id} not exist`);
        return;
      }

      const pk = decrypt(controller.encryptedKey);
      const wallet = new Wallet(toBuffer(pk), this.provider);

      // send SQT
      const sqtBalance = await this.sdk.sqToken.balanceOf(wallet.address);
      if (!sqtBalance.eq(0)) {
        const tx = await this.sdk.sqToken.connect(wallet).transfer(indexer, sqtBalance);
        await tx.wait(5);
      }

      // send Chain Token
      const value = await this.provider.getBalance(wallet.address);
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

  updateSDK(key: string) {
    const keyBuffer = toBuffer(key);
    this.wallet = new Wallet(keyBuffer, this.provider);
    this.sdk = initContractSDK(this.wallet, this.chainID);
  }

  async updateContractSDK(): Promise<ContractSDK | undefined> {
    const controllers = await this.controllerRepo.find();
    const indexer = await this.accountService.getIndexer();
    if (!indexer || isEmpty(controllers)) {
      getLogger('account').warn('No controller account config in service');
      return;
    }

    // check current sdk signer is same with the controller account on network
    const controllerAccount = await this.indexerToController(indexer);
    debugLogger('contract', `Wallet address used by contract sdk: ${this.wallet.address}`);
    debugLogger('contract', `Indexer address: ${indexer}`);
    debugLogger('contract', `Controller address: ${controllerAccount}`);

    if (this.sdk && this.wallet?.address.toLowerCase() === controllerAccount) {
      debugLogger('contract', 'contract sdk is up to date');
      return this.sdk;
    }

    const controller = controllers.find((c) => c.address.toLocaleLowerCase() === controllerAccount);
    if (!controller) getLogger('contract').error(`Controller account: ${controllerAccount} not exist`);

    this.updateSDK(decrypt(controller.encryptedKey));
    return this.sdk;
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
