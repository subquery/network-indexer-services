// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { bufferToHex, privateToAddress, toBuffer } from 'ethereumjs-util';
import { v4 as uuid } from 'uuid';
import crypto from 'crypto';
import { Wallet } from 'ethers';

import { decrypt, encrypt } from 'src/utils/encrypt';
import { AccountEvent } from 'src/utils/subscription';
import { SubscriptionService } from 'src/subscription/subscription.service';
import { Config } from 'src/configure/configure.module';

import { Repository } from 'typeorm';
import { Account, ControllerType } from './account.model';
import { isEmpty } from 'lodash';

@Injectable()
export class AccountService {
  private indexer: string;

  constructor(
    @InjectRepository(Account) private accountRepo: Repository<Account>,
    private pubSub: SubscriptionService,
    private config: Config,
  ) {}

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

  async addController(): Promise<string> {
    const controller = this.generateControllerWallet();
    const encryptedController = encrypt(controller.privateKey);
    const indexer = await this.getIndexer();
    const account = this.accountRepo.create({
      id: uuid(),
      indexer,
      controller: encryptedController,
    });

    await this.accountRepo.save(account);

    const meta = await this.getMetadata();
    this.pubSub.publish(AccountEvent.Controller, { accountChanged: meta });

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
      address: this.privateToAdress(decrypt(c.controller)),
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
