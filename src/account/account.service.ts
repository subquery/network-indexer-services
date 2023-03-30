// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { bufferToHex, privateToAddress, toBuffer } from 'ethereumjs-util';
import { v4 as uuid } from 'uuid';
import crypto from 'crypto';
import { Wallet } from 'ethers';

import { encrypt } from 'src/utils/encrypt';
import { AccountEvent } from 'src/utils/subscription';
import { SubscriptionService } from 'src/subscription/subscription.service';
import { Config } from 'src/configure/configure.module';

import { Repository } from 'typeorm';
import { Indexer, Controller, ControllerType, AccountType, AccountMetaDataType } from './account.model';
import { ContractService } from 'src/services/contract.service';
import { ContractSDK } from '@subql/contract-sdk';

@Injectable()
export class AccountService {
  private indexer: string | undefined;
  private controller: string;
  private sdk: ContractSDK;

  constructor(
    @Inject(forwardRef(() => ContractService)) private contractService: ContractService,
    @InjectRepository(Indexer) private indexerRepo: Repository<Indexer>,
    @InjectRepository(Controller) private controllerRepo: Repository<Controller>,
    private pubSub: SubscriptionService,
    private config: Config,
  ) {}

  async getIndexer(): Promise<string> {
    if (!this.indexer) {
      const indexer = await this.indexerRepo.findOne();
      this.indexer = indexer?.address;
    }

    return this.indexer;
  }

  privateToAdress(key: string) {
    return bufferToHex(privateToAddress(toBuffer(key))).toLowerCase();
  }

  getAccountMetadata(): AccountMetaDataType {
    return {
      indexer: this.indexer,
      controller: this.controller,
      network: this.config.network,
      wsEndpoint: this.config.wsEndpoint,
    };
  }

  async emitAccountChanged(): Promise<AccountMetaDataType> {
    const accountMeta = this.getAccountMetadata();
    this.pubSub.publish(AccountEvent.Indexer, { accountChanged: accountMeta });
    return accountMeta;
  }

  async addIndexer(indexer: string): Promise<AccountType> {
    if (this.indexer !== undefined && indexer !== this.indexer) {
      throw new Error(`Indexer account already exists ${this.indexer}`);
    }

    if (!this.indexer) {
      this.indexer = indexer;
      const indexerAccount = this.indexerRepo.create({ id: uuid(), address: indexer });
      await this.indexerRepo.save(indexerAccount);
      await this.emitAccountChanged();
    }

    return { indexer, controller: '' };
  }

  onAddControllerEvent() {
    this.contractService.getSdk().indexerRegistry.on('SetControllerAccount', async (indexer, controller) => {
      if (this.indexer !== indexer) return;
      this.controller = controller;
      this.emitAccountChanged();
    });
  }

  // create and add controller account
  async addController(): Promise<string> {
    this.onAddControllerEvent();

    const pk = `0x${crypto.randomBytes(32).toString('hex')}`;
    const controller = new Wallet(pk);

    await this.controllerRepo.save(
      this.controllerRepo.create({
        id: uuid(),
        address: controller.address,
        encryptedKey: encrypt(controller.privateKey),
      }),
    );

    return controller.address;
  }

  getController(id: string): Promise<Controller> {
    return this.controllerRepo.findOne({ where: { id } });
  }

  async removeController(id: string): Promise<Controller> {
    console.log('>>>id:', id);
    const controller = await this.controllerRepo.findOne({ where: { id } });
    await this.controllerRepo.delete(id);

    console.log('controller:', controller);

    return controller;
  }

  async getControllers(): Promise<ControllerType[]> {
    const controllers = await this.controllerRepo.find();
    return controllers.map((c) => ({ id: c.id, address: c.address }));
  }

  async removeAccounts(): Promise<AccountMetaDataType> {
    this.indexer = undefined;
    await this.indexerRepo.clear();
    await this.controllerRepo.clear();

    const accountMetadata = await this.emitAccountChanged();
    return accountMetadata;
  }
}
