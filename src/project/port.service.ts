// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import portfinder from 'portfinder';

import { debugLogger } from 'src/utils/logger';

import { ProjectEntity } from './project.model';
import { Config } from 'src/configure/configure.module';

@Injectable()
export class PortService {
  constructor(
    @InjectRepository(ProjectEntity) private projectRepo: Repository<ProjectEntity>,
    private config: Config,
  ) {
    portfinder.setBasePort(config.startPort);
  }

  async getAvailablePort(): Promise<number> {
    const port = await portfinder.getPortPromise();
    debugLogger('node', `next port: ${port}`);

    return port;
  }
}
