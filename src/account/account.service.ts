// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { v4 as uuid } from 'uuid';
import { encrypt } from '../utils/encrypto';
import { DeleteResult, Repository } from 'typeorm';
import { Account } from './account.model';
import { isEmpty } from 'lodash';
import { Config } from '../configure/configure.module';

@Injectable()
export class AccountService {
  private indexer: string;

  constructor(
    @InjectRepository(Account) private accountRepo: Repository<Account>,
    private config: Config,
  ) { }

  addIndexer(indexer: string): Promise<Account> {
    if (indexer === this.indexer) {
      return this.getIndexerAccount();
    }

    this.indexer = indexer;
    const account = this.accountRepo.create({
      id: uuid(),
      indexer,
      controller: '',
    });

    return this.accountRepo.save(account);
  }

  async getMetadata(): Promise<{ indexer: string; network: string; wsEndpoint: string }> {
    const indexer = await this.getIndexer();
    const network = this.config.network;
    const wsEndpoint = this.config.wsEndpoint;

    return { indexer, network, wsEndpoint };
  }

  async getIndexerAccount(): Promise<Account | undefined> {
    const accounts = await this.accountRepo.find({
      where: { controller: '' },
    });
    if (isEmpty(accounts)) return undefined;
    return accounts[0];
  }

  async getIndexer(): Promise<string> {
    if (this.indexer) return this.indexer;
    const account = await this.getIndexerAccount();
    return account?.indexer || '';
  }

  async addController(controller: string): Promise<Account> {
    const encryptedController = encrypt(controller);
    const indexer = await this.getIndexer();
    const account = this.accountRepo.create({
      id: uuid(),
      indexer,
      controller: encryptedController,
    });

    return this.accountRepo.save(account);
  }

  async getAccounts(): Promise<Account[]> {
    return this.accountRepo.find();
  }

  deleteAccount(id: string): Promise<DeleteResult> {
    return this.accountRepo.delete(id);
  }

  async removeAccounts(): Promise<string> {
    this.indexer = undefined;
    const accounts = await this.getAccounts();
    await this.accountRepo.remove(accounts);

    return '';
  }
}
