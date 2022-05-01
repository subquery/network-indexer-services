// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { isEmpty } from 'lodash';
import fetch, { Response } from 'node-fetch';
import { nodeContainer, queryContainer } from 'src/utils/docker';
import { debugLogger } from 'src/utils/logger';
import { ZERO_BYTES32 } from 'src/utils/project';
import { ContractService } from './contract.service';
import { DockerService } from './docker.service';

import { ProjectService } from './project.service';
import { ServiceStatus, MetaData, Poi } from './types';

@Injectable()
export class QueryService {
  private emptyPoi: Poi;

  constructor(
    private projectService: ProjectService,
    private docker: DockerService,
    private contract: ContractService,
  ) {
    this.emptyPoi = { blockHeight: 0, mmrRoot: ZERO_BYTES32 };
  }

  private serviceStatus(info: string): ServiceStatus {
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

  private async queryRequest(id: string, body: string): Promise<Response> {
    const project = await this.projectService.getProject(id);
    const { queryEndpoint } = project;

    return fetch(`${queryEndpoint}/graphql`, {
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      body: body,
    });
  }

  public async getQueryMetaData(id: string): Promise<MetaData> {
    const indexerInfo = await this.docker.ps([nodeContainer(id)]);
    const queryInfo = await this.docker.ps([queryContainer(id)]);
    const indexerStatus = this.serviceStatus(indexerInfo);
    const queryStatus = this.serviceStatus(queryInfo);

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
      const response = await this.queryRequest(id, queryBody);
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

  public async getMmrRoot(id: string, blockHeight: number): Promise<string> {
    const queryBody = JSON.stringify({
      query: `{
        _poi(id: ${blockHeight}) {
          id
          mmrRoot
        }
      }`,
    });

    try {
      const response = await this.queryRequest(id, queryBody);
      const data = await response.json();
      if (!data.data._poi) return ZERO_BYTES32;

      const mmrRoot = data.data._poi.mmrRoot;
      return mmrRoot.replace('\\', '0').substring(0, 66);
    } catch {
      return ZERO_BYTES32;
    }
  }

  public async getLastPoi(id: string): Promise<Poi> {
    // TODO: will replace with another api to get the latest mmrRoot value
    const queryBody = JSON.stringify({
      query: `{
        _pois(last: 1000, orderBy: "PRIMARY_KEY_DESC") {
          nodes {
            id
            mmrRoot
          }
        }
      }`,
    });

    try {
      const response = await this.queryRequest(id, queryBody);
      const data = await response.json();
      const pois = data.data._pois.nodes as Poi[];
      if (isEmpty(pois)) return this.emptyPoi;

      const poi = pois.find((v) => !!v.mmrRoot);
      if (!poi) return this.emptyPoi;

      const mmrRoot = poi.mmrRoot.replace('\\', '0').substring(0, 66);
      return { blockHeight: poi.blockHeight, mmrRoot };
    } catch {
      return this.emptyPoi;
    }
  }

  async getValidPoi(id: string): Promise<Poi> {
    const metadata = await this.getQueryMetaData(id);
    const blockHeight = metadata.lastProcessedHeight;
    if (blockHeight === 0) return this.emptyPoi;

    const project = await this.projectService.getProject(id);
    if (!project.poiEnabled) return { blockHeight, mmrRoot: ZERO_BYTES32 };

    const mmrRoot = await this.getMmrRoot(id, blockHeight);
    if (mmrRoot !== ZERO_BYTES32) return { blockHeight, mmrRoot };

    return this.getLastPoi(id);
  }

  public async getReportPoi(id: string): Promise<Poi> {
    try {
      const poi = await this.getValidPoi(id);
      const { blockHeight, mmrRoot } = poi;
      if (blockHeight === 0) return poi;

      const indexingStatus = await this.contract.deploymentStatusByIndexer(id);
      if (indexingStatus.blockHeight.lt(blockHeight)) return poi;

      debugLogger(
        'report',
        `project: ${id} | network block height: ${indexingStatus.blockHeight.toNumber()} lg ${blockHeight} mmrRoot: ${mmrRoot}`,
      );
    } catch (e) {
      debugLogger('report', `failed to get report poi: ${e}`);
    }

    return this.emptyPoi;
  }
}
