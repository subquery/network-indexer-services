// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DesiredStatus } from 'src/core/types';
import { getLogger } from 'src/utils/logger';
import { Repository } from 'typeorm';
import { SubgraphManifest } from './project.manifest';
import { IProjectConfig, MetadataType, Project, ProjectEntity } from './project.model';
import { ProjectService } from './project.service';
import { requestSubgraph } from './subgraph.request';
import { SubgraphEndpoint, SubgraphPortType, SubgraphPort, SubgraphEndpointType } from './types';

const logger = getLogger('project.subgraph.service');

@Injectable()
export class ProjectSubgraphService {
  constructor(
    @InjectRepository(ProjectEntity) private projectRepo: Repository<ProjectEntity>,
    private projectService: ProjectService
  ) {}

  getRequiredPortsTypes(): string[] {
    return [SubgraphPortType.IndexNodePort, SubgraphPortType.HttpPort];
  }

  async getSubgraphEndpoints(
    host: string,
    ports: SubgraphPort[],
    cid: string
  ): Promise<SubgraphEndpoint[]> {
    const httpPort = ports.find((p) => p.key === SubgraphPortType.HttpPort).value;
    const indexNodePort = ports.find((p) => p.key === SubgraphPortType.IndexNodePort).value;
    if (!httpPort || !indexNodePort) {
      throw new Error('Missing required ports');
    }
    const indexNodeUrl = `http://${host}:${indexNodePort}/graphql`;
    const subgraphData = await requestSubgraph(indexNodeUrl, cid);
    const projectId = subgraphData?.indexingStatuses[0]?.project?.id;
    const httpEndpoint = `http://${host}:${httpPort}`;
    const httpProjectUrl = `${httpEndpoint}/subgraphs/id/${projectId}`;
    const endpoints: SubgraphEndpoint[] = [];
    endpoints.push({ key: SubgraphEndpointType.IndexNodeEndpoint, value: indexNodeUrl });
    endpoints.push({ key: SubgraphEndpointType.HttpEndpoint, value: httpProjectUrl });
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
      return this.getRequiredPortsTypes().includes(endpoint.key);
    });
    projectConfig.serviceEndpoints = project.serviceEndpoints;

    // const validateResult = await this.validateProjectEndpoints(project, project.serviceEndpoints);
    // if (!validateResult.valid) {
    //   throw new Error(`Invalid endpoints: ${validateResult.reason}`);
    // }

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
    let lastTime = 0;
    let targetHeight = 0;
    try {
      if (endpoint) {
        const subgraphData = await requestSubgraph(endpoint.value, '');
        startHeight = subgraphData?.earliestBlock?.number;
        lastHeight = subgraphData?.lastHealthyBlock?.number;
        lastTime = 0;
        targetHeight = subgraphData?.latestBlock?.number;
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
      chain: manifest.chain.chainId,
      specName: '',
      genesisHash: manifest.chain.genesisHash,
      indexerNodeVersion: '',
      queryNodeVersion: '',
      indexerStatus: '',
      queryStatus: '',
    };
  }
}
