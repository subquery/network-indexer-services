// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { isEmpty } from 'lodash';
import fetch, { Response } from 'node-fetch';

import { HostType } from 'src/project/types';
import { MetadataType, NodeMetadataType, Project } from '../project/project.model';
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

  async getQueryMetaData(
    id: string,
    queryEndpoint: string,
    nodeEndpoint?: string,
    hostType?: HostType
  ): Promise<MetadataType> {
    let indexerStatus: string = ServiceStatus.NotStarted;
    let queryStatus: string = ServiceStatus.NotStarted;
    if (hostType === HostType.SYSTEM_MANAGED) {
      const status = await this.servicesStatus(id);
      indexerStatus = status.indexerStatus;
      queryStatus = status.queryStatus;
    } else if (hostType === HostType.USER_MANAGED) {
      if (nodeEndpoint) {
        // indexerStatus = ServiceStatus.UnHealthy;
        queryStatus = ServiceStatus.UnHealthy;
        const nodeMetadata = await this.getNodeMetaData(nodeEndpoint);
        indexerStatus =
          nodeMetadata.targetHeight > 0 ? ServiceStatus.Healthy : ServiceStatus.UnHealthy;
      }
    }

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
      const response = await this.queryRequest(queryEndpoint, queryBody);
      const data = await response.json();
      const metadata = data.data._metadata;

      return {
        lastHeight: metadata.lastProcessedHeight ?? 0,
        lastTime: metadata.lastProcessedTimestamp ?? 0,
        startHeight: metadata.startHeight ?? 0,
        targetHeight: metadata.targetHeight ?? 0,
        healthy: metadata.indexerHealthy ?? false,
        chain: metadata.chain ?? '',
        specName: metadata.specName ?? '',
        genesisHash: metadata.genesisHash ?? '',
        indexerNodeVersion: metadata.indexerNodeVersion ?? '',
        queryNodeVersion: metadata.queryNodeVersion ?? '',
        indexerStatus: metadata.indexerHealthy ? indexerStatus : ServiceStatus.UnHealthy,
        queryStatus: ServiceStatus.Healthy,
      };
    } catch (e) {
      return {
        lastHeight: 0,
        lastTime: 0,
        startHeight: 0,
        targetHeight: 0,
        healthy: false,
        chain: '',
        specName: '',
        genesisHash: '',
        indexerNodeVersion: '',
        queryNodeVersion: '',
        indexerStatus,
        queryStatus,
      };
    }
  }

  async getNodeMetaData(endpoint: string): Promise<NodeMetadataType> {
    try {
      const url = new URL('meta', endpoint);
      const response = await axios.get(url.toString(), {
        timeout: 5000,
      });
      if (response.status !== 200) {
        return {
          currentProcessingTimestamp: 0,
          targetHeight: 0,
          startHeight: 0,
          bestHeight: 0,
          indexerNodeVersion: '',
        };
      }
      return response.data as NodeMetadataType;
    } catch (err) {
      return {
        currentProcessingTimestamp: 0,
        targetHeight: 0,
        startHeight: 0,
        bestHeight: 0,
        indexerNodeVersion: '',
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
      hostType,
      queryEndpoint,
      nodeEndpoint,
      advancedConfig: { poiEnabled },
    } = project;

    const metadata = await this.getQueryMetaData(id, queryEndpoint, nodeEndpoint, hostType);
    const blockHeight = metadata.lastHeight;
    if (blockHeight === 0) return this.emptyPoi;

    if (!poiEnabled) return { blockHeight, mmrRoot: ZERO_BYTES32 };

    const mmrRoot = await this.getMmrRoot(nodeEndpoint, blockHeight);
    if (mmrRoot !== ZERO_BYTES32) return { blockHeight, mmrRoot };

    return this.getLastPoi(id, queryEndpoint);
  }
}
