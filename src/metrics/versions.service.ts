// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { Config } from '../configure/configure.module';
import { DockerService } from '../core/docker.service';
import { debugLogger } from '../utils/logger';
import { VersionMetrics } from './metrics.model';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { version: coordinatorVersion } = require('../../package.json');

@Injectable()
export class VersionsService {
  constructor(private docker: DockerService, private config: Config) {}

  formatVersion(version: string) {
    const defaultVersion = [0, 0, 0, 0];
    if (version === 'latest') return defaultVersion;

    try {
      const a = version.replace(/^v/, '').replace(/-/, '.');
      const versionNums = a.split('.').map((i) => Number(i));

      return versionNums.length === 3 ? [...versionNums, 0] : versionNums;
    } catch (e) {
      debugLogger('metrics', `failed to decode service versions: ${String(e)}`);
      return defaultVersion;
    }
  }

  async getVersions(): Promise<VersionMetrics> {
    const proxyVersion = await this.docker.imageVersion('indexer_proxy');
    return {
      coordinator: this.formatVersion(coordinatorVersion),
      proxy: this.formatVersion(proxyVersion),
    };
  }
}
