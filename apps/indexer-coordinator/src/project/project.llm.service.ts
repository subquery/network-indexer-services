// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DesiredStatus } from 'src/core/types';
import { getLogger } from 'src/utils/logger';
import { getDomain, getIpAddress, isIp, isPrivateIp } from 'src/utils/network';
import { Repository } from 'typeorm';
import { RpcManifest } from './project.manifest';
import {
  IProjectConfig,
  MetadataType,
  Project,
  ProjectEntity,
  SeviceEndpoint,
  ValidationResponse,
} from './project.model';
import { ProjectService } from './project.service';
import { RequiredRpcType, getRpcFamilyObject } from './rpc.factory';
import { AccessType, ProjectType } from './types';

const logger = getLogger('project.llm.service');

@Injectable()
export class ProjectLLMService {
  constructor() {}

  async startLLMProject(
    id: string,
    projectConfig: IProjectConfig,
    rateLimit: number
  ): Promise<Project> {
    // check ollama model exists

    // ollama run
    return new Project();
  }
}
