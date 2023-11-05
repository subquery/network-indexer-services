// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { isEmpty } from 'lodash';
import fetch, { Response } from 'node-fetch';

import { MetadataType, Project } from '../project/project.model';
import { nodeContainer, queryContainer } from '../utils/docker';
import { ZERO_BYTES32 } from '../utils/project';

import { AccountService } from './account.service';
import { ContractService } from './contract.service';
import { DockerService } from './docker.service';
import { Poi, PoiItem, ServiceStatus } from './types';

@Injectable()
export class QueryService {
  private emptyPoi: Poi;

  constructor(
    private docker: DockerService,
    private accountService: AccountService,
    private contract: ContractService
  ) {
    this.emptyPoi = { blockHeight: 0, mmrRoot: ZERO_BYTES32 };
  }

  private serviceStatus(state: any): ServiceStatus {
    if (!state || Object.keys(state).length === 0) {
      return ServiceStatus.NotStarted;
    } else if (state?.Health?.Status === 'starting') {
      return ServiceStatus.Starting;
    } else if (state?.Health?.Status === 'healthy') {
      return ServiceStatus.Healthy;
    } else if (state?.Status === 'exited') {
      return ServiceStatus.Terminated;
    }
    return ServiceStatus.UnHealthy;
  }

  private async queryRequest(queryEndpoint: string, body: string): Promise<Response> {
    return fetch(`${queryEndpoint}/graphql`, {
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      body: body,
    });
  }

  private async servicesStatus(
    id: string
  ): Promise<{ indexerStatus: string; queryStatus: string }> {
    try {
      const indexerInfo = (await this.docker.ps([nodeContainer(id)]))[0];
      const queryInfo = (await this.docker.ps([queryContainer(id)]))[0];
      const indexerStatus = this.serviceStatus(indexerInfo);
      const queryStatus = this.serviceStatus(queryInfo);

      return { indexerStatus, queryStatus };
    } catch {
      return { indexerStatus: ServiceStatus.Starting, queryStatus: ServiceStatus.Starting };
    }
  }

  async getQueryMetaData(id: string, endpoint: string): Promise<MetadataType> {
    const { indexerStatus, queryStatus } = await this.servicesStatus(id);
    const queryBody = JSON.stringify({
      query: `{
        _metadata {
          lastProcessedHeight
          lastProcessedTimestamp
          startHeight
          targetHeight
          chain
          specName
          genesisHash
          indexerHealthy
          indexerNodeVersion
          queryNodeVersion
        }
      }`,
    });

    try {
      const response = await this.queryRequest(endpoint, queryBody);
      const data = await response.json();
      const metadata = data.data._metadata;

      return {
        ...metadata,
        startHeight: metadata.startHeight ?? 0,
        targetHeight: metadata.targetHeight ?? 0,
        lastProcessedTimestamp: metadata.lastProcessedTimestamp ?? 0,
        lastProcessedHeight: metadata.lastProcessedHeight ?? 0,
        indexerHealthy: metadata.indexerHealthy ?? false,
        indexerStatus: metadata.indexerHealthy ? indexerStatus : ServiceStatus.UnHealthy,
        queryStatus: ServiceStatus.Healthy,
      };
    } catch (e) {
      return {
        lastProcessedHeight: 0,
        lastProcessedTimestamp: 0,
        startHeight: 0,
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

  async getMmrRoot(endpoint: string, blockHeight: number): Promise<string> {
    try {
      const url = new URL(`mmrs/${blockHeight}`, endpoint);
      const response = await fetch(url);
      const data = await response.json();
      const mmrRoot = data.mmrRoot;

      return mmrRoot ?? ZERO_BYTES32;
    } catch {
      return ZERO_BYTES32;
    }
  }

  async getLastPoi(id: string, endpoint: string): Promise<Poi> {
    const queryBody = JSON.stringify({
      query: `{
        _pois(last: 100) {
          nodes {
            id
            mmrRoot
          }
        }
      }`,
    });

    try {
      const response = await this.queryRequest(endpoint, queryBody);
      const data = await response.json();
      const pois = data.data._pois.nodes as PoiItem[];
      if (isEmpty(pois)) return this.emptyPoi;

      const poi = pois.reverse().find((v) => !!v.mmrRoot);
      if (!poi) return this.emptyPoi;

      const mmrRoot = poi.mmrRoot.replace('\\', '0').substring(0, 66);
      return { blockHeight: poi.id, mmrRoot };
    } catch {
      return this.emptyPoi;
    }
  }

  async getValidPoi(project: Project): Promise<Poi> {
    const {
      id,
      queryEndpoint,
      nodeEndpoint,
      advancedConfig: { poiEnabled },
    } = project;

    const metadata = await this.getQueryMetaData(id, queryEndpoint);
    const blockHeight = metadata.lastProcessedHeight;
    if (blockHeight === 0) return this.emptyPoi;

    if (!poiEnabled) return { blockHeight, mmrRoot: ZERO_BYTES32 };

    const mmrRoot = await this.getMmrRoot(nodeEndpoint, blockHeight);
    if (mmrRoot !== ZERO_BYTES32) return { blockHeight, mmrRoot };

    return this.getLastPoi(id, queryEndpoint);
  }
}
