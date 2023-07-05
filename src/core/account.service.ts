// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import crypto from 'crypto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ContractSDK } from '@subql/contract-sdk';
import { bufferToHex, privateToAddress, toBuffer } from 'ethereumjs-util';
import { Wallet } from 'ethers';
import { initContractSDK, initProvider, networkToChainID } from 'src/utils/contractSDK';
import { ILike, Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';

import { Config } from '../configure/configure.module';
import { encrypt } from '../utils/encrypt';
import { getLogger } from '../utils/logger';
import { Indexer, Controller, AccountMetaDataType } from './account.model';

const logger = getLogger('account');

@Injectable()
export class AccountService {
  private indexer: string | undefined;
  private sdk: ContractSDK;

  constructor(
    @InjectRepository(Indexer) private indexerRepo: Repository<Indexer>,
    @InjectRepository(Controller) private controllerRepo: Repository<Controller>,
    private config: Config,
  ) {
    const chainID = networkToChainID[config.network];
    const provider = initProvider(config.wsEndpoint, chainID);
    this.sdk = initContractSDK(provider, chainID);
  }

  async getIndexer(): Promise<string> {
    if (!this.indexer) {
      const indexer = await this.indexerRepo.find({ take: 1 });
      this.indexer = indexer?.[0]?.address;
    }

    return this.indexer;
  }

  privateToAdress(key: string) {
    return bufferToHex(privateToAddress(toBuffer(key))).toLowerCase();
  }

  async addIndexer(address: string): Promise<Indexer> {
    if (this.indexer !== undefined && address !== this.indexer) {
      throw new Error(`Indexer account already exists ${this.indexer}`);
    }

    if (!this.indexer) {
      this.indexer = address;
      const indexerAccount = this.indexerRepo.create({ id: uuid(), address: address });
      await this.indexerRepo.save(indexerAccount);
    }

    return { address: address, id: '' };
  }

  // create and add controller account
  async addController(): Promise<string> {
    const pk = `0x${crypto.randomBytes(32).toString('hex')}`;
    const controller = new Wallet(pk);
    const encryptedKey = encrypt(controller.privateKey, this.config.secret);

    await this.controllerRepo.save(
      this.controllerRepo.create({
        id: uuid(),
        active: false,
        address: controller.address,
        encryptedKey,
      }),
    );

    return controller.address;
  }

  getController(id: string): Promise<Controller> {
    return this.controllerRepo.findOne({ where: { id } });
  }

  async removeController(id: string): Promise<Controller> {
    const controller = await this.controllerRepo.findOne({ where: { id } });
    await this.controllerRepo.delete(id);

    return controller;
  }

  async getAccountMetadata(): Promise<AccountMetaDataType> {
    const controller = await this.getActiveController();
    return {
      indexer: this.indexer,
      controller: controller?.address ?? '',
      encryptedKey: controller?.encryptedKey ?? '',
      network: this.config.network,
      wsEndpoint: this.config.wsEndpoint,
    };
  }

  async getActiveController(): Promise<Controller | undefined> {
    const controller = await this.sdk.indexerRegistry.getController(this.indexer);
    const controllerAccount = controller ? controller.toLowerCase() : '';
    if (!controllerAccount) {
      logger.warn("Controller Account hasn't been set");
      return;
    }

    const query = { where: { address: ILike(`%${controllerAccount}%`) } };
    const controllerObj = await this.controllerRepo.findOne(query);

    if (controllerObj) return controllerObj;

    logger.warn("Don't have controller pk in db");
  }

  async getControllers(): Promise<Controller[]> {
    return this.controllerRepo.find();
  }

  async removeAccounts(): Promise<AccountMetaDataType> {
    this.indexer = undefined;
    await this.indexerRepo.clear();
    await this.controllerRepo.clear();

    return this.getAccountMetadata();
  }
}
