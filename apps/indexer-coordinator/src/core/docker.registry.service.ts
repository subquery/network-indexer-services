// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable, OnModuleInit } from '@nestjs/common';
import axios from 'axios';
import LRU from 'lru-cache';
import * as semver from 'semver';
import { getYargsOption } from '../yargs';

export enum DockerRegistry {
  query = 'onfinality/subql-query',
  node = 'onfinality/subql-node',
}

@Injectable()
export class DockerRegistryService implements OnModuleInit {
  private cache: LRU<string, string[]>;

  onModuleInit() {
    const options = { max: 50, ttl: 1000 * 3600 };
    this.cache = new LRU(options);
  }

  async getRegistryVersions(registry: DockerRegistry, range: string): Promise<string[]> {
    const tags = await this.getTags(registry);
    return this.filterRegistryVersions(tags, range);
  }

  private getCacheKey(registry: DockerRegistry): string {
    return `indexer-coordinator/registry/${registry}`;
  }

  private async getTags(registry: DockerRegistry): Promise<string[]> {
    const cacheKey = this.getCacheKey(registry);
    const cacheTags = this.cache.get(cacheKey);
    if (cacheTags) return cacheTags;

    const tokenUrl = `https://auth.docker.io/token?service=registry.docker.io&scope=repository:${registry}:pull`;
    const tagsUrl = `https://registry-1.docker.io/v2/${registry}/tags/list`;

    const token = await axios.get(tokenUrl).then<string>((r) => r.data.token);
    const headers = { Authorization: `Bearer ${token}` };
    const tags = await axios.get(tagsUrl, { headers }).then((r) => r.data.tags);
    this.cache.set(cacheKey, tags);

    return tags;
  }

  private enablePrerelease(): boolean {
    const { argv } = getYargsOption();
    return argv['use-prerelease'];
  }

  private filterRegistryVersions(tags: string[], range: string) {
    if (!semver.validRange(range)) return tags;

    const result = tags
      .filter((t) => {
        if (semver.prerelease(t)) return this.enablePrerelease();
        if (semver.prerelease(semver.validRange(range))) {
          return semver.satisfies(t, range);
        } else {
          return semver.satisfies(semver.coerce(t), range);
        }
      })
      .sort((a, b) => {
        const vA = semver.clean(a);
        const vB = semver.clean(b);

        if (semver.eq(vB, vA)) return 0;
        return semver.gt(vB, vA) ? 1 : -1;
      });

    return result;
  }
}
