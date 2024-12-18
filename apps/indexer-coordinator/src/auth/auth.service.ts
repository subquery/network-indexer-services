// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import {
  TypedMessage,
  SignTypedDataVersion,
  MessageTypes,
  recoverTypedSignature,
} from '@metamask/eth-sig-util';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { ConfigService } from '../config/config.service';
import { AccountService } from '../core/account.service';
import { SignData } from './types';

const SALT_ROUNDS = 10;
const EXPIRES_IN = '3 days';

@Injectable()
export class AuthService {
  constructor(
    private accountService: AccountService,
    private configService: ConfigService,
    private jwtService: JwtService
  ) {}

  async setPassword(password: string, data: SignData) {
    await this.checkSign(data);
    const hash = bcrypt.hashSync(password, SALT_ROUNDS);
    await this.configService.setPassword(hash);
  }

  private async checkSign(data: SignData) {
    const indexer = await this.accountService.getIndexer();
    if (!indexer) {
      throw new Error('indexer not set');
    }

    const address = recoverTypedSignature<SignTypedDataVersion.V4, MessageTypes>({
      data: data.payload as unknown as TypedMessage<MessageTypes>,
      signature: data.sign,
      version: SignTypedDataVersion.V4,
    });

    if (indexer.toLowerCase() !== address) {
      throw new Error(`invalid sign. indexer:${indexer}, address:${address}`);
    }
  }

  async signIn(password: string): Promise<string> {
    const hash = await this.configService.getPassword();
    if (!hash) {
      throw new Error('password not set');
    }
    const match = await bcrypt.compare(password, hash);
    if (!match) {
      throw new Error('mismatched password');
    }

    const payload = { now: Date.now() };
    const token = await this.jwtService.signAsync(payload, {
      secret: hash,
      expiresIn: EXPIRES_IN,
    });
    return token;
  }
}
