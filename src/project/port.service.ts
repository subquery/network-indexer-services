// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import {Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import portfinder from 'portfinder';
import {Repository} from 'typeorm';

import {Config} from '../configure/configure.module';
import {getServicePort} from '../utils/docker';
import {debugLogger} from '../utils/logger';

import {ProjectEntity} from './project.model';

@Injectable()
export class PortService {
  private ports: number[];
  private defaultStartPort: number;

  constructor(
    @InjectRepository(ProjectEntity) private projectRepo: Repository<ProjectEntity>,
    private config: Config,
  ) {
    this.defaultStartPort = config.startPort;
    portfinder.setBasePort(config.startPort);

    void this.getUsedPorts().then((ports) => {
      this.ports = ports;
      debugLogger('project', `Used ports: ${this.ports.join(',')}`);
    });
  }

  async getAvailablePort(): Promise<number> {
    let port: number;
    let startPort = this.defaultStartPort;
    for (let i = 0; i < 10; i++) {
      const _port = await portfinder.getPortPromise({port: startPort});
      if (this.ports.includes(port)) {
        startPort = _port+1;
      } else {
        port = _port;
        break;
      }
    }
    if (!port) throw new Error(`can not find available port`);

    debugLogger('node', `next port: ${port}`);
    this.addPort(port);

    return port;
  }

  async getUsedPorts(): Promise<number[]> {
    const projects = await this.projectRepo.find();
    if (projects.length === 0) return [];

    return projects
      .map(({queryEndpoint}) => getServicePort(queryEndpoint))
      .filter((p) => typeof p === 'number');
  }

  addPort(port: number) {
    if (!port) return;
    if (!this.ports.includes(port)) {
      this.ports.push(port);
    }
  }

  removePort(port: number) {
    if (!port) return;

    const index = this.ports.indexOf(port);
    if (index >= 0) {
      this.ports.splice(index, 1);
    }
  }
}
