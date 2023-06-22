// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { ContractSDK } from '@subql/contract-sdk';
import { cidToBytes32 } from '@subql/network-clients';
import { isValidPrivate, toBuffer } from 'ethereumjs-util';
import { BigNumber, Overrides } from 'ethers';
import { Wallet, providers } from 'ethers';
import { parseEther } from 'ethers/lib/utils';

import { Config } from '../configure/configure.module';
import { ChainID, initContractSDK, initProvider, networkToChainID } from '../utils/contractSDK';
import { decrypt } from '../utils/encrypt';
import { debugLogger, getLogger } from '../utils/logger';
import { Controller } from './account.model';
import { AccountService } from './account.service';
import { DeploymentStatus, IndexingStatus } from './types';

const logger = getLogger('contract');

@Injectable()
export class ContractService {
  private wallet: Wallet;
  private sdk: ContractSDK;
  private provider: providers.StaticJsonRpcProvider;
  private emptyDeploymentStatus;
  private chainID: ChainID;
  private existentialBalance: BigNumber;

  constructor(private accountService: AccountService, private config: Config) {
    this.chainID = networkToChainID[config.network];
    this.emptyDeploymentStatus = { status: IndexingStatus.NOTINDEXING, blockHeight: 0 };
    this.existentialBalance = parseEther('0.05');
    this.provider = initProvider(config.wsEndpoint, this.chainID);
    this.sdk = initContractSDK(this.provider, this.chainID);
  }

  getSdk() {
    return this.sdk;
  }

  async getOverrides(): Promise<Overrides> {
    const gasPrice = await this.provider.getGasPrice();
    return { gasPrice };
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

  async withdrawAll(id: string, indexer: string, controller: Controller): Promise<boolean> {
    try {
      const pk = decrypt(controller.encryptedKey, this.config.secret);
      const wallet = new Wallet(toBuffer(pk), this.provider);

      // send SQT
      const sqtBalance = await this.sdk.sqToken.balanceOf(wallet.address);
      if (!sqtBalance.eq(0)) {
        const overrides = await this.getOverrides();
        const tx = await this.sdk.sqToken.connect(wallet).transfer(indexer, sqtBalance, overrides);
        await tx.wait(5);
      }

      // send Chain Token
      const gasPrice = await this.provider.getGasPrice();
      const tokenTransferGas = BigNumber.from(21000).mul(gasPrice);
      const balance = await this.provider.getBalance(wallet.address);
      const value = balance.sub(tokenTransferGas);
      const txToken = await wallet.sendTransaction({ to: indexer, value, gasPrice });
      await txToken.wait(5);

      logger.info(`Transfer all funds from controller to indexer successfully`);

      return true;
    } catch (e) {
      logger.warn(e, `Fail to transfer all funds from controller to indexer`);
      return false;
    }
  }

  isValidPrivateKey(key: string) {
    return key.startsWith('0x') && isValidPrivate(toBuffer(key));
  }

  updateSDK(key: string) {
    const keyBuffer = toBuffer(key);
    this.wallet = new Wallet(keyBuffer, this.provider);
    this.sdk = initContractSDK(this.wallet, this.chainID);
  }

  async updateContractSDK(): Promise<ContractSDK | undefined> {
    const indexer = await this.accountService.getIndexer();
    if (!indexer) {
      logger.error('No indexer configured');
      return;
    }

    const controller = await this.accountService.getActiveController();
    if (!controller) return;

    const controllerAccount = controller?.address.toLowerCase() ?? '';
    if (this.sdk && this.wallet?.address.toLowerCase() === controllerAccount) {
      debugLogger('contract', `contract sdk is connected to ${this.wallet?.address}`);
      return this.sdk;
    }

    // check current sdk signer is same with the controller account on network
    debugLogger('contract', `Indexer address: ${indexer}`);
    debugLogger('contract', `Controller address: ${controllerAccount}`);
    this.updateSDK(decrypt(controller.encryptedKey, this.config.secret));
    debugLogger('contract', `Update wallet used by contract sdk: ${this.wallet?.address}`);
    return this.sdk;
  }

  async deploymentStatusByIndexer(id: string, indexer: string): Promise<DeploymentStatus> {
    if (!this.sdk || !indexer) return this.emptyDeploymentStatus;
    try {
      const { status, blockHeight } = await this.sdk.queryRegistry.deploymentStatusByIndexer(
        cidToBytes32(id.trim()),
        indexer,
      );
      return { status, blockHeight };
    } catch (e) {
      getLogger('contract').error(e, `failed to get indexing status for project: ${id}`);
      return this.emptyDeploymentStatus;
    }
  }
}
