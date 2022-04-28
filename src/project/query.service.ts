// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { isEmpty } from 'lodash';
import fetch from 'node-fetch';
import { nodeContainer, queryContainer } from 'src/utils/docker';
import { DockerService } from './docker.service';

import { ProjectService } from './project.service';
import { ServiceStatus, MetaData } from './types';

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

  public async getQueryMetaData(id: string): Promise<MetaData> {
    const indexerInfo = await this.docker.ps([nodeContainer(id)]);
    const queryInfo = await this.docker.ps([queryContainer(id)]);
    const indexerStatus = this.serviceStatus(indexerInfo);
    const queryStatus = this.serviceStatus(queryInfo);

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
        indexerStatus: metadata.indexerHealthy ? indexerStatus : ServiceStatus.UnHealthy,
        queryStatus: ServiceStatus.Healthy,
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

  public async getPoi(id: string, blockHeight: number): Promise<string> {
    const project = await this.projectService.getProject(id);
    const queryBody = JSON.stringify({
      query: `{
        _poi(id: ${blockHeight}) {
          id
          mmrRoot
        }
      }`,
    });

    try {
      const response = await fetch(`${project.queryEndpoint}/graphql`, {
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
        body: queryBody,
      });

      const data = await response.json();
      if (!data.data._poi) return '';

      const mmrRoot = data.data._poi.mmrRoot;
      return mmrRoot.replace('\\', '0').substring(0, 66);
    } catch {
      return '';
    }
  }
}
