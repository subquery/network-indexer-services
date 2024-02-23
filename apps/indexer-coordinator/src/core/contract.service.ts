// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { ContractSDK } from '@subql/contract-sdk';
import { cidToBytes32 } from '@subql/network-clients';
import { isValidPrivate, toBuffer } from 'ethereumjs-util';
import { BigNumber, Overrides, Wallet, providers } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { mutexPromise } from 'src/utils/promise';
import { Config } from '../configure/configure.module';
import { ChainID, initContractSDK, initProvider, networkToChainID } from '../utils/contractSDK';
import { decrypt } from '../utils/encrypt';
import { TextColor, colorText, debugLogger, getLogger } from '../utils/logger';
import { Controller } from './account.model';
import { AccountService } from './account.service';
import { IndexerDeploymentStatus, TxFun } from './types';

const MAX_RETRY = 3;
const logger = getLogger('contract');

@Injectable()
export class ContractService {
  private wallet: Wallet;
  private sdk: ContractSDK;
  private provider: providers.StaticJsonRpcProvider;
  private chainID: ChainID;
  private existentialBalance: BigNumber;

  constructor(private accountService: AccountService, private config: Config) {
    this.chainID = networkToChainID[config.network];
    this.existentialBalance = parseEther('0.001');
    this.provider = initProvider(config.networkEndpoint, this.chainID);
    this.sdk = initContractSDK(this.provider, this.chainID);
  }

  getSdk() {
    return this.sdk;
  }

  async getOverrides(): Promise<Overrides> {
    const gasPrice = await this.provider.getGasPrice();
    const gasLimit = BigNumber.from(1000000);
    return { gasPrice, gasLimit };
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

  async isEmptyAccount(account: string) {
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
      const gasLimit = BigNumber.from(21000);
      const tokenTransferGas = gasPrice.mul(gasLimit);
      const balance = await this.provider.getBalance(wallet.address);
      let value = balance.sub(tokenTransferGas);
      // l1DataFee is arround 4000 * [20 ~ 60] * 1000000000 and it keeps changing
      // we use overshot here to make a more accurate estimate
      const l1DataFee = await this.tryTranserOrGetOvershot(wallet, {
        to: indexer,
        value,
        gasPrice,
        gasLimit: gasLimit,
      });
      if (l1DataFee.eq(0)) {
        return true;
      }
      // add 1% to avoid insufficient funds
      value = value.sub(l1DataFee.mul(101).div(100));
      const txToken = await this.walletTransfer(wallet, {
        to: indexer,
        value,
        gasPrice,
        gasLimit: gasLimit,
      });
      await txToken.wait(5);

      logger.info(`Transfer all funds from controller to indexer successfully`);

      return true;
    } catch (e) {
      logger.warn(e, `Fail to transfer all funds from controller to indexer`);
      return false;
    }
  }

  async walletTransfer(
    wallet: Wallet,
    request: providers.TransactionRequest
  ): Promise<providers.TransactionResponse> {
    return wallet.sendTransaction(request);
  }

  async tryTranserOrGetOvershot(
    wallet: Wallet,
    request: providers.TransactionRequest
  ): Promise<BigNumber> {
    try {
      const tx = await this.walletTransfer(wallet, request);
      await tx.wait(5);
      return BigNumber.from(0);
    } catch (e: any) {
      if (!e.message.includes('insufficient funds')) {
        throw e;
      }
      const match = e.message.match(/overshot (\d+)/);
      let overshot = match && match[1];
      if (isNaN(overshot)) {
        overshot = 0;
      }
      return BigNumber.from(overshot);
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

  async deploymentStatusByIndexer(id: string, indexer: string): Promise<IndexerDeploymentStatus> {
    if (!this.sdk || !indexer) return IndexerDeploymentStatus.TERMINATED;
    try {
      const status = await this.sdk.projectRegistry.deploymentStatusByIndexer(
        cidToBytes32(id.trim()),
        indexer
      );
      return status as IndexerDeploymentStatus;
    } catch (e) {
      logger.error(e, `failed to get indexing status for project: ${id}`);
      return IndexerDeploymentStatus.TERMINATED;
    }
  }

  @mutexPromise()
  async sendTransaction(actionName: string, txFun: TxFun, desc = '') {
    await this._sendTransaction(actionName, txFun, desc);
  }

  private async _sendTransaction(actionName: string, txFun: TxFun, desc = '', retries = 0) {
    try {
      logger.info(`${colorText(actionName)}: ${colorText('PROCESSING', TextColor.YELLOW)} ${desc}`);

      const overrides = await this.getOverrides();
      const tx = await txFun(overrides);
      await tx.wait(10);

      logger.info(`${colorText(actionName)}: ${colorText('SUCCEED', TextColor.GREEN)}`);

      return;
    } catch (e) {
      if (retries < MAX_RETRY) {
        logger.warn(`${colorText(actionName)}: ${colorText('RETRY', TextColor.YELLOW)} ${desc}`);
        await this._sendTransaction(actionName, txFun, desc, retries + 1);
      } else {
        logger.warn(e, `${colorText(actionName)}: ${colorText('FAILED', TextColor.RED)}`);
        throw e;
      }
    }
  }
}
