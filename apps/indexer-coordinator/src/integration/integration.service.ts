// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { IntegrationEntity } from './integration.model';

@Injectable()
export class IntegrationService {
  constructor(
    @InjectRepository(IntegrationEntity)
    private integrationRepo: Repository<IntegrationEntity>
  ) {}

  async get(id: number): Promise<IntegrationEntity> {
    return this.integrationRepo.findOne({ where: { id } });
  }

  async getAll(): Promise<IntegrationEntity[]> {
    return this.integrationRepo.find();
  }
}
