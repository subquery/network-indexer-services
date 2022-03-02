// Copyright 2020-2021 OnFinality Limited authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import fetch from 'node-fetch';
import { Repository, Not } from 'typeorm';
import { Project } from './project.model';
import { MetaData } from '@subql/common';
import { IndexingStatus } from './types';
import { getLogger } from 'src/utils/logger';
import { DockerService } from './docker.service';
import {
  generateDockerComposeFile,
  nodeEndpoint,
  projectContainers,
  projectId,
  queryEndpoint,
  TemplateType,
} from 'src/utils/docker';

@Injectable()
export class ProjectService {
  private port: number;
  constructor(
    @InjectRepository(Project) private projectRepo: Repository<Project>,
    private docker: DockerService,
  ) {
    this.port = 3000;
  }

  async getProject(id: string): Promise<Project> {
    return this.projectRepo.findOne({ id });
  }

  async getIndexerMetaData(id: string): Promise<MetaData> {
    const project = await this.getProject(id);
    const { indexerEndpoint } = project;

    const response = await fetch(new URL(`meta`, indexerEndpoint));
    const result = await response.json();
    // FIXME: error handling
    return result;
  }

  async getQueryMetaData(id: string): Promise<MetaData> {
    const project = await this.getProject(id);
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

    const response = await fetch(`${queryEndpoint}/graphql`, {
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      body: queryBody,
    });

    const data = await response.json();
    return data.data._metadata;
  }

  async getProjects(): Promise<Project[]> {
    return this.projectRepo.find();
  }

  async getAliveProjects(): Promise<Project[]> {
    return this.projectRepo.find({
      where: {
        queryEndpoint: Not(''),
      },
    });
  }

  async addProject(id: string): Promise<Project> {
    const project = this.projectRepo.create({
      id,
      status: 0,
      indexerEndpoint: '',
      queryEndpoint: '',
      blockHeight: 0,
    });

    return this.projectRepo.save(project);
  }

  async updateProjectStatus(id: string, status: IndexingStatus): Promise<Project> {
    const project = await this.projectRepo.findOne({ id });
    project.status = status;
    return this.projectRepo.save(project);
  }

  async updateProjectServices(
    id: string,
    indexerEndpoint?: string,
    queryEndpoint?: string,
    status?: IndexingStatus,
  ): Promise<Project> {
    const project = await this.projectRepo.findOne({ id });
    if (indexerEndpoint) {
      project.indexerEndpoint = indexerEndpoint;
    }
    if (queryEndpoint) {
      project.queryEndpoint = queryEndpoint;
    }
    if (status) {
      project.status = status;
    }

    return this.projectRepo.save(project);
  }

  async removeProject(id: string): Promise<Project[]> {
    const project = await this.getProject(id);
    return this.projectRepo.remove([project]);
  }

  async removeProjects(): Promise<Project[]> {
    const projects = await this.getProjects();
    return this.projectRepo.remove(projects);
  }

  // docker project management
  async createAndStartProject(deploymentID: string): Promise<Project> {
    // create templete item
    // TODO: should get these information from contract
    // FIXME: `servicePort` should be increased
    const projectID = projectId(deploymentID);
    const item: TemplateType = {
      deploymentID,
      projectID,
      // FIXME: networkEndpoint and dictionatry url should include in the `metadata`
      networkEndpoint: 'wss://acala-polkadot.api.onfinality.io/public-ws',
      dictionary: 'https://api.subquery.network/sq/subquery/acala-dictionary',
      nodeVersion: 'v0.29.1',
      queryVersion: 'v0.12.0',
      servicePort: ++this.port,
    };

    try {
      // 1. create new db
      await this.docker.createDB(`db_${projectID}`);
      // 2. generate new docker compose file
      generateDockerComposeFile(item);
      // 3. docker compose up
      await this.docker.up(item.deploymentID);
    } catch (e) {
      getLogger('docker').error(`start project failed: ${e}`);
    }

    return this.updateProjectServices(
      item.deploymentID,
      nodeEndpoint(deploymentID, this.port),
      queryEndpoint(deploymentID, this.port),
      IndexingStatus.INDEXING,
    );
  }

  async stopProject(deploymentID: string) {
    const project = await this.getProject(deploymentID);
    if (!project) {
      getLogger('docker').error(`project not exist: ${deploymentID}`);
      return;
    }

    getLogger('docker').info(`stop project: ${deploymentID}`);
    this.docker.stop(projectContainers(deploymentID));
    return this.updateProjectStatus(deploymentID, IndexingStatus.TERMINATED);
  }

  async restartProject(deploymentID: string) {
    const project = await this.getProject(deploymentID);
    if (!project) {
      getLogger('docker').error(`project not exist: ${deploymentID}`);
    }

    getLogger('docker').info(`restart project: ${deploymentID}`);
    this.docker.start(projectContainers(deploymentID));
    return this.updateProjectStatus(deploymentID, IndexingStatus.INDEXING);
  }
}
