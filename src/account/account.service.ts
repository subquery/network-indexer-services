// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { bufferToHex, privateToAddress, toBuffer } from 'ethereumjs-util';
import { v4 as uuid } from 'uuid';
import crypto from 'crypto';
import { Wallet } from 'ethers';

import { getLogger } from 'src/utils/logger';
import { decrypt, encrypt } from 'src/utils/encrypt';
import { AccountEvent } from 'src/utils/subscription';
import { SubscriptionService } from 'src/subscription/subscription.service';
import { Config } from 'src/configure/configure.module';

import { Repository } from 'typeorm';
import { Account, ControllerType } from './account.model';
import { isEmpty } from 'lodash';
import { ContractService } from 'src/services/contract.service';
import { ContractSDK } from '@subql/contract-sdk';

@Injectable()
export class AccountService {
  private indexer: string;
  private sdk: ContractSDK;

  constructor(
    @Inject(forwardRef(() => ContractService)) private contractService: ContractService,
    @InjectRepository(Account) private accountRepo: Repository<Account>,
    private pubSub: SubscriptionService,
    private config: Config,
  ) {}

  async initContractSDK() {
    try {
      if (this.sdk) return;
      await this.contractService.updateContractSDK();
      this.sdk = this.contractService.getSdk();
    } catch (e) {
      getLogger('account').error(`Failed to init contract sdk ${e}`);
    }
  }

  privateToAdress(key: string) {
    return bufferToHex(privateToAddress(toBuffer(key))).toLowerCase();
  }

  generateControllerWallet(): Wallet {
    const pk = `0x${crypto.randomBytes(32).toString('hex')}`;
    return new Wallet(pk);
  }

  async addIndexer(indexer: string): Promise<Account> {
    if (indexer === this.indexer) {
      return this.getIndexerAccount();
    }

    this.indexer = indexer;
    const controller = '';
    const account = this.accountRepo.create({
      id: uuid(),
      indexer,
      controller,
    });

    const new_account = await this.accountRepo.save(account);

    const meta = await this.getMetadata();
    this.pubSub.publish(AccountEvent.Indexer, { accountChanged: meta });

    return new_account;
  }

  async getMetadata(): Promise<{ indexer: string; controller: string; network: string; wsEndpoint: string }> {
    const accounts = await this.getAccounts();
    let account;
    if (!isEmpty(accounts)) {
      account = accounts[accounts.length - 1];
    }
    const indexer = account?.indexer || '';
    const controller = account?.controller || '';
    const network = this.config.network;
    const wsEndpoint = this.config.wsEndpoint;

    return { indexer, controller, network, wsEndpoint };
  }

  async getIndexerAccount(): Promise<Account | undefined> {
    const accounts = await this.accountRepo.find({
      where: { controller: '' },
    });
    if (isEmpty(accounts)) return undefined;
    return accounts[accounts.length - 1];
  }

  async getIndexer(): Promise<string> {
    if (this.indexer) return this.indexer;
    const account = await this.getIndexerAccount();
    return account?.indexer || '';
  }

  onAddControllerEvent() {
    this.sdk.indexerRegistry.on('SetControllerAccount', async (indexer, controller) => {
      const meta = await this.getMetadata();
      this.pubSub.publish(AccountEvent.Controller, { accountChanged: { ...meta, controller } });
    });
  }

  async addController(): Promise<string> {
    await this.initContractSDK();
    this.onAddControllerEvent();

    const controller = this.generateControllerWallet();
    const encryptedController = encrypt(controller.privateKey, this.config.secret);
    const indexer = await this.getIndexer();
    const account = this.accountRepo.create({
      id: uuid(),
      indexer,
      controller: encryptedController,
    });

    await this.accountRepo.save(account);

    return controller.address;
  }

  async getAccounts(): Promise<Account[]> {
    return this.accountRepo.find();
  }

  async getAccount(id: string): Promise<Account | undefined> {
    const accounts = await this.accountRepo.find({ where: { id } });
    if (isEmpty(accounts)) return undefined;
    return accounts[accounts.length - 1];
  }

  async getControllers(): Promise<ControllerType[]> {
    const accounts = await this.getAccounts();
    const controllers = accounts.filter((a) => !!a.controller);

    return controllers.map((c) => ({
      address: (() => {
        const controllerSk = decrypt(c.controller, this.config.secret);
        let controllerAddress = '0x00000000000000000000000000000000000000';
        if (!isEmpty(controllerSk)) {
          controllerAddress = this.privateToAdress(controllerSk);
        }
        return controllerAddress;
      })(),
      id: c.id,
    }));
  }

  async deleteAccount(id: string): Promise<Account> {
    const account = await this.getAccount(id);
    await this.accountRepo.delete(id);

    const meta = await this.getMetadata();
    this.pubSub.publish(AccountEvent.Controller, { accountChanged: meta });

    return account;
  }

  async removeAccounts(): Promise<string> {
    this.indexer = undefined;
    const accounts = await this.getAccounts();
    await this.accountRepo.remove(accounts);

    const meta = await this.getMetadata();
    this.pubSub.publish(AccountEvent.Indexer, { accountChanged: meta });

    return '';
  }
}
