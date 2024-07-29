// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectLLMService } from '../project/project.llm.service';
import { SeviceEndpoint, ValidationResponse } from '../project/project.model';
import { IntegrationType, LLMConfig, LLMExtra } from '../project/types';
import { IntegrationEntity } from './integration.model';

@Injectable()
export class IntegrationService {
  constructor(
    @InjectRepository(IntegrationEntity)
    private integrationRepo: Repository<IntegrationEntity>,
    private projectLLMService: ProjectLLMService
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
    serviceEndpoints: SeviceEndpoint[],
    config?: LLMConfig,
    extra?: LLMExtra
  ): Promise<IntegrationEntity> {
    let integration = await this.integrationRepo.findOne({ where: { title } });
    if (integration) {
      throw new Error(`${title} already exist`);
    }

    let validateResult: ValidationResponse = { valid: true, reason: '' };
    switch (type) {
      case IntegrationType.LLM:
        validateResult = await this.projectLLMService.validate(serviceEndpoints[0].value);
        break;
      default:
        throw new Error('Unsupported integration type');
    }

    if (!validateResult.valid) {
      throw new Error(validateResult.reason);
    }

    integration = new IntegrationEntity();
    integration.title = title;
    integration.type = type;
    integration.enabled = true;
    integration.serviceEndpoints = serviceEndpoints;
    integration.config = config || {};
    integration.extra = extra || {};
    return this.integrationRepo.save(integration);
  }

  async update(
    id: number,
    title: string,
    serviceEndpoints: SeviceEndpoint[],
    enabled: boolean,
    config?: LLMConfig,
    extra?: LLMExtra
  ): Promise<IntegrationEntity> {
    let integration = await this.integrationRepo.findOne({ where: { title } });
    if (integration && integration.id !== id) {
      throw new Error(`${title} already exist`);
    }

    integration = await this.integrationRepo.findOne({ where: { id } });
    if (!integration) {
      throw new Error(`${id} not exist`);
    }

    let validateResult: ValidationResponse = { valid: true, reason: '' };
    switch (integration.type) {
      case IntegrationType.LLM:
        validateResult = await this.projectLLMService.validate(serviceEndpoints[0].value);
        break;
      default:
        throw new Error('Unsupported integration type');
    }

    if (!validateResult.valid) {
      throw new Error(validateResult.reason);
    }

    integration.title = title;
    integration.enabled = true;
    integration.serviceEndpoints = serviceEndpoints;
    integration.enabled = enabled;
    integration.config = config || {};
    integration.extra = extra || {};
    return this.integrationRepo.save(integration);
  }
}
