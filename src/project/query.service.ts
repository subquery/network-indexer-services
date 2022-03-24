// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { MetaData } from '@subql/common';
import { isEmpty } from 'lodash';
import fetch from 'node-fetch';
import { nodeContainer } from 'src/utils/docker';
import { DockerService } from './docker.service';

import { ProjectService } from './project.service';

@Injectable()
export class QueryService {
  constructor(private projectService: ProjectService, private docker: DockerService) { }

  async indexerServiceHealth(id: string): Promise<boolean> {
    const result = await this.docker.ps([nodeContainer(id)]);
    return !(isEmpty(result) || result.includes('Exited'));
  }

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
      const metadata = data.data._metadata;
      const indexerServiceHealthy = await this.indexerServiceHealth(id);
      const indexerHealthy = indexerServiceHealthy && metadata.indexerHealthy;

      return { ...metadata, indexerHealthy };
    } catch {
      return;
    }
  }
}
