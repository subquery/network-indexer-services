// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DesiredStatus } from 'src/core/types';
import { getLogger } from 'src/utils/logger';
import { Repository } from 'typeorm';
import WebSocket from 'ws';
import { SubgraphManifest } from './project.manifest';
import {
  IProjectConfig,
  MetadataType,
  Project,
  ProjectEntity,
  SeviceEndpoint,
  ValidationResponse,
} from './project.model';
import { ProjectService } from './project.service';
import { requestSubgraphNode, requestSubgraphMeta } from './subgraph.request';
import {
  SubgraphEndpoint,
  SubgraphPortType,
  SubgraphPort,
  SubgraphEndpointType,
  ProjectType,
} from './types';

const logger = getLogger('project.subgraph.service');

@Injectable()
export class ProjectSubgraphService {
  constructor(
    @InjectRepository(ProjectEntity) private projectRepo: Repository<ProjectEntity>,
    private projectService: ProjectService
  ) {}

  @Cron('0 */9 * * * *')
  async autoValidateSubgraphEndpoints() {
    const projects = (await this.projectService.getAliveProjects()).filter(
      (project) => project.projectType === ProjectType.SUBGRAPH
    );
    for (const project of projects) {
      await this.validateProjectEndpoints(project, project.serviceEndpoints);
    }
    await this.projectRepo.save(projects);
  }

  private async validateProjectEndpoints(project: Project, endpoints: SeviceEndpoint[]) {
    const indexNodeEndpoint = endpoints.find(
      (endpoint) => endpoint.key === SubgraphEndpointType.IndexNodeEndpoint
    );
    const httpEndpoint = endpoints.find(
      (endpoint) => endpoint.key === SubgraphEndpointType.HttpEndpoint
    );
    const wsEndpoint = endpoints.find(
      (endpoint) => endpoint.key === SubgraphEndpointType.WsEndpoint
    );

    const validateResult = await this.validateSubgraphNodeEndpoint(
      indexNodeEndpoint.value,
      project.id
    );
    indexNodeEndpoint.valid = validateResult.valid;
    indexNodeEndpoint.reason = validateResult.reason;

    const validateResult2 = await this.validateSubgraphHttpProjectEndpoint(httpEndpoint.value);
    httpEndpoint.valid = validateResult2.valid;
    httpEndpoint.reason = validateResult2.reason;

    const validateResult3 = await this.validateSubgraphWsProjectEndpoint(wsEndpoint.value);
    wsEndpoint.valid = validateResult3.valid;
    wsEndpoint.reason = validateResult3.reason;
  }

  getRequiredPortsTypes(): string[] {
    return [SubgraphPortType.IndexNodePort, SubgraphPortType.HttpPort, SubgraphPortType.WsPort];
  }

  async getSubgraphEndpoints(
    host: string,
    ports: SubgraphPort[],
    cid: string
  ): Promise<SubgraphEndpoint[]> {
    const indexNodePort = ports.find((p) => p.key === SubgraphPortType.IndexNodePort).value;
    const httpPort = ports.find((p) => p.key === SubgraphPortType.HttpPort).value;
    const wsPort = ports.find((p) => p.key === SubgraphPortType.WsPort).value;
    if (!httpPort || !indexNodePort) {
      throw new Error('Missing required ports');
    }
    const indexNodeUrl = `http://${host}:${indexNodePort}/graphql`;
    const httpEndpoint = `http://${host}:${httpPort}`;
    const httpProjectUrl = `${httpEndpoint}/subgraphs/id/${cid}`;
    const wsEndpoint = `ws://${host}:${wsPort}`;
    const wsProjectUrl = `${wsEndpoint}/subgraphs/id/${cid}`;
    const validateResult = await this.validateSubgraphNodeEndpoint(indexNodeUrl, cid);
    if (!validateResult.valid) {
      throw new Error(`Invalid endpoints: ${validateResult.reason}`);
    }
    const validateResult2 = await this.validateSubgraphHttpProjectEndpoint(httpProjectUrl);
    if (!validateResult2.valid) {
      throw new Error(`Invalid endpoints: ${validateResult2.reason}`);
    }
    const validateResult3 = await this.validateSubgraphWsProjectEndpoint(wsProjectUrl);
    if (!validateResult3.valid) {
      throw new Error(`Invalid endpoints: ${validateResult3.reason}`);
    }
    const endpoints: SubgraphEndpoint[] = [];
    endpoints.push({ key: SubgraphEndpointType.IndexNodeEndpoint, value: indexNodeUrl });
    endpoints.push({ key: SubgraphEndpointType.HttpEndpoint, value: httpProjectUrl });
    endpoints.push({ key: SubgraphEndpointType.WsEndpoint, value: wsProjectUrl });
    return endpoints;
  }

  async startSubgraphProject(
    id: string,
    projectConfig: IProjectConfig,
    rateLimit: number
  ): Promise<Project> {
    let project = await this.projectService.getProject(id);
    if (!project) {
      project = await this.projectService.addProject(id);
    }
    project.projectConfig = projectConfig;
    project.status = DesiredStatus.RUNNING;
    project.rateLimit = rateLimit;

    project.serviceEndpoints = projectConfig.serviceEndpoints.filter((endpoint) => {
      return [
        SubgraphEndpointType.IndexNodeEndpoint,
        SubgraphEndpointType.HttpEndpoint,
        SubgraphEndpointType.WsEndpoint,
      ].includes(endpoint.key as SubgraphEndpointType);
    });
    projectConfig.serviceEndpoints = project.serviceEndpoints;

    const validateResult = await this.validateSubgraphNodeEndpoint(
      project.serviceEndpoints.find(
        (endpoint) => endpoint.key === SubgraphEndpointType.IndexNodeEndpoint
      )?.value,
      id
    );
    if (!validateResult.valid) {
      throw new Error(`Invalid endpoints: ${validateResult.reason}`);
    }
    const validateResult2 = await this.validateSubgraphHttpProjectEndpoint(
      project.serviceEndpoints.find(
        (endpoint) => endpoint.key === SubgraphEndpointType.HttpEndpoint
      )?.value
    );
    if (!validateResult2.valid) {
      throw new Error(`Invalid endpoints: ${validateResult2.reason}`);
    }
    const validateResult3 = await this.validateSubgraphWsProjectEndpoint(
      project.serviceEndpoints.find((endpoint) => endpoint.key === SubgraphEndpointType.WsEndpoint)
        ?.value
    );
    if (!validateResult3.valid) {
      throw new Error(`Invalid endpoints: ${validateResult3.reason}`);
    }

    return this.projectRepo.save(project);
  }

  async stopSubgraphProject(id: string): Promise<Project> {
    const project = await this.projectService.getProject(id);
    if (!project) {
      return;
    }
    project.status = DesiredStatus.STOPPED;
    return this.projectRepo.save(project);
  }

  async removeSubgraphProject(id: string): Promise<Project[]> {
    const project = await this.projectService.getProject(id);
    if (!project) {
      return [];
    }
    return this.projectRepo.remove([project]);
  }

  async getSubgraphMetadata(id: string): Promise<MetadataType> {
    const project = await this.projectService.getProject(id);
    if (!project) {
      return;
    }
    const manifest = project.manifest as SubgraphManifest;
    const endpoint = project.serviceEndpoints.find(
      (endpoint) => endpoint.value && endpoint.key === SubgraphEndpointType.IndexNodeEndpoint
    );
    let startHeight = 0;
    let lastHeight = 0;
    let targetHeight = 0;
    const lastTime = 0;
    try {
      if (endpoint) {
        const result = await requestSubgraphNode(endpoint.value, id);
        if (!result.success) {
          throw new Error(`Failed to request subgraph index node`);
        }
        const chainData = result?.data?.indexingStatuses?.[0]?.chains?.[0];
        startHeight = chainData?.earliestBlock?.number || 0;
        lastHeight = chainData?.latestBlock?.number || 0;
        targetHeight = chainData?.chainHeadBlock?.number || 0;
      }
    } catch (e) {
      logger.debug(`getSubgraphMetadata error: ${e}`);
    }
    return {
      startHeight,
      lastHeight,
      lastTime,
      targetHeight,
      healthy: !!endpoint?.valid,
      chain: manifest?.chain?.chainId,
      specName: '',
      genesisHash: manifest?.chain?.genesisHash,
      indexerNodeVersion: '',
      queryNodeVersion: '',
      indexerStatus: '',
      queryStatus: '',
    };
  }

  async validateSubgraphNodeEndpoint(
    nodeEndpointUrl: string,
    cid: string
  ): Promise<ValidationResponse> {
    const result = await requestSubgraphNode(nodeEndpointUrl, cid);
    if (!result.success) {
      return {
        valid: false,
        reason: `Subgraph index node is not valid`,
      };
    }
    if (result?.data?.indexingStatuses?.[0]?.subgraph === cid) {
      return {
        valid: true,
        reason: '',
      };
    }
    return {
      valid: false,
      reason: `Subgraph project not found`,
    };
  }

  async validateSubgraphHttpProjectEndpoint(httpEndpointUrl: string): Promise<ValidationResponse> {
    const result = await requestSubgraphMeta(httpEndpointUrl);
    if (!result.success) {
      return {
        valid: false,
        reason: `Subgraph http endpoint is not valid`,
      };
    }
    if (result?.data?._meta?.block?.number) {
      return {
        valid: true,
        reason: '',
      };
    }
    return {
      valid: false,
      reason: `Subgraph http endpoint is not valid`,
    };
  }

  async validateSubgraphWsProjectEndpoint(wsEndpointUrl: string): Promise<ValidationResponse> {
    return Promise.resolve({ valid: true, reason: '' });
    // const ws = new WebSocket(wsEndpointUrl);
    // try {
    //   return await Promise.race<ValidationResponse>([
    //     new Promise((resolve, reject) => {
    //       ws.onopen = function open() {
    //         resolve({ valid: true, reason: '' });
    //       };
    //       ws.onerror = function (error) {
    //         logger.error(`Ws connect error: ${error.message}`);
    //         reject(error.message);
    //       };
    //     }),
    //     new Promise((_, reject_1) => {
    //       setTimeout(() => {
    //         reject_1('Ws connect timeout');
    //       }, 5000);
    //     }),
    //   ]);
    // } catch (e) {
    //   return {
    //     valid: false,
    //     reason: `Subgraph ws endpoint is not valid: ${wsEndpointUrl}`,
    //   };
    // } finally {
    //   ws.terminate();
    // }
  }
}
