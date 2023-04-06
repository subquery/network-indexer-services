// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { isEmpty } from 'lodash';

import { debugLogger } from 'src/utils/logger';
import { getServicePort } from 'src/utils/docker';
import { getYargsOption } from 'src/yargs';

import { ProjectEntity } from './project.model';

@Injectable()
export class PortService {
  private ports: number[];
  constructor(@InjectRepository(ProjectEntity) private projectRepo: Repository<ProjectEntity>) {
    this.getUsedPorts().then((ports) => {
      this.ports = ports;
      debugLogger('project', `initial ports: ${this.ports}`);
    });
  }

  getMmrPath() {
    const { argv } = getYargsOption();
    return argv['mmrPath'].replace(/\/$/, '');
  }

  async getUsedPorts(): Promise<number[]> {
    const projects = await this.projectRepo.find();
    if (projects.length === 0) return [];

    return projects
      .map(({ queryEndpoint }) => getServicePort(queryEndpoint))
      .filter((p) => typeof p === 'number');
  }

  async getAvailablePort(): Promise<number> {
    if (isEmpty(this.ports)) return 3100;

    const maxPort = Math.max(...this.ports);
    const port = maxPort + 1;
    // FIXME: dynamic port allocation
    // for (let i = 3000; i < maxPort; i++) {
    //   const p = this.ports.find((p) => p === i);
    //   if (p) continue;
    //   port = i;
    //   break;
    // }

    debugLogger('project', `used ports: ${this.ports}`);
    debugLogger('project', `next port: ${port}`);

    this.ports.push(port);
    return port;
  }

  async removePort(port: number) {
    if (!port) return;

    const index = this.ports.indexOf(port);
    if (index >= 0) {
      this.ports.splice(index, 1);
    }
  }
}
