// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { SeviceEndpoint } from '../project/project.model';
import { IntegrationType } from '../project/types';
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

  async create(
    title: string,
    type: IntegrationType,
    serviceEndpoints: SeviceEndpoint[]
  ): Promise<IntegrationEntity> {
    // todo: check if title exists
    const integration = new IntegrationEntity();
    integration.title = title;
    integration.type = type;
    integration.serviceEndpoints = serviceEndpoints;

    // todo: check if serviceEndpoints are valid
    return this.integrationRepo.save(integration);
  }
}
