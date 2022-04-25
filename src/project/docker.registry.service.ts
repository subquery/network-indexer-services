// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable, OnModuleInit } from '@nestjs/common';
// import { Cache } from 'cache-manager';
import semver from 'semver';
import axios from 'axios';

export enum DockerRegistry {
  query = 'onfinality/subql-query',
  node = 'onfinality/subql-node',
}

@Injectable()
export class DockerRegistryService implements OnModuleInit {
  // constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) { }

  public onModuleInit() {
    // this.deleteCache(DockerRegistry.query);
    // this.deleteCache(DockerRegistry.node);
  }

  public async getRegistryVersions(
    registry: DockerRegistry,
    range: semver.Range,
  ): Promise<string[]> {
    const tags = await this.getTags(registry);
    return this.filterRegistryVersions(tags, range);
  }

  private tokenUrl(registry: DockerRegistry) {
    return `https://auth.docker.io/token?service=registry.docker.io&scope=repository:${registry}:pull`;
  }

  private tagsUrl(registry: DockerRegistry) {
    return `https://registry-1.docker.io/v2/${registry}/tags/list`;
  }

  // private deleteCache(registry: DockerRegistry) {
  //   this.cache.del(this.getCacheKey(registry));
  // }

  // private getCacheKey(registry: DockerRegistry): string {
  //   return `indexer-coordinator/registry/${registry}`;
  // }

  private async getTags(registry: DockerRegistry): Promise<string[]> {
    // const cacheKey = this.getCacheKey(registry);
    // const cacheTags = await this.cache.get<string[]>(cacheKey);
    // if (cacheTags) return cacheTags;

    const token = await axios.get(this.tokenUrl(registry)).then((r) => r.data.token);
    const headers = { Authorization: `Bearer ${token}` };
    const tags = await axios.get(this.tagsUrl(registry), { headers }).then((r) => r.data.tags);
    // await this.cache.set(cacheKey, tags, { ttl: 30 * 60 });

    return tags;
  }

  private filterRegistryVersions(tags: string[], range: semver.Range) {
    if (!semver.validRange(range)) return tags;

    const result = tags
      .filter((t) => {
        // TODO: need to confirm whether support prerelease version
        if (semver.prerelease(t)) return false;
        if (semver.prerelease(range)) {
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
