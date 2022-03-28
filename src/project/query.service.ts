// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { MetaData } from '@subql/common';
import { isEmpty } from 'lodash';
import fetch from 'node-fetch';
import { nodeContainer, queryContainer } from 'src/utils/docker';
import { DockerService } from './docker.service';

import { ProjectService } from './project.service';

enum ServiceStatus {
  Starting = 'STARTING',
  Healthy = 'HEALTHY',
  UnHealthy = 'UNHEALTHY',
  NotStarted = 'NOT START',
  Terminated = 'TERMINATED',
}

@Injectable()
export class QueryService {
  constructor(private projectService: ProjectService, private docker: DockerService) { }

  serviceStatus(info: string): ServiceStatus {
    if (isEmpty(info)) {
      return ServiceStatus.NotStarted;
    } else if (info.includes('starting')) {
      return ServiceStatus.Starting;
    } else if (info.includes('healthy')) {
      return ServiceStatus.Healthy;
    } else if (info.includes('Exited')) {
      return ServiceStatus.Terminated;
    }
    return ServiceStatus.UnHealthy;
  }

  async getQueryMetaData(id: string): Promise<MetaData> {
    const indexerInfo = await this.docker.ps([nodeContainer(id)]);
    const queryInfo = await this.docker.ps([queryContainer(id)]);
    const indexerStatus = this.serviceStatus(indexerInfo).toString();
    const queryStatus = this.serviceStatus(queryInfo).toString();

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

      return {
        ...metadata,
        indexerStatus: metadata.indexerHealthy ? indexerStatus : ServiceStatus.UnHealthy.toString(),
        queryStatus: ServiceStatus.Healthy.toString(),
      };
    } catch {
      return {
        lastProcessedHeight: 0,
        lastProcessedTimestamp: 0,
        targetHeight: 0,
        chain: '',
        specName: '',
        genesisHash: '',
        indexerHealthy: false,
        indexerNodeVersion: '',
        queryNodeVersion: '',
        indexerStatus,
        queryStatus,
      };
    }
  }
}
