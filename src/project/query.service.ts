// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { MetaData } from '@subql/common';
import fetch from 'node-fetch';

import { ProjectService } from './project.service';

@Injectable()
export class QueryService {
  constructor(private projectService: ProjectService) { }

  async getQueryMetaData(id: string): Promise<MetaData> {
    const project = await this.projectService.getProject(id);
    const { queryEndpoint } = project;

    const queryBody = JSON.stringify({
      query: `{
        _metadata {
          lastProcessedHeight
          lastProcessedTimestamp
          targetHeight
          chain
          specName
          genesisHash
          indexerHealthy
          indexerNodeVersion
          queryNodeVersion
        }}`,
    });

    try {
      const response = await fetch(`${queryEndpoint}/graphql`, {
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
        body: queryBody,
      });
      const data = await response.json();
      return data.data._metadata;
    } catch {
      return;
    }
  }
}
