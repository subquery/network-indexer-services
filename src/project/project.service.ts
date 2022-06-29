// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';

import { Config } from 'src/configure/configure.module';
import { getLogger } from 'src/utils/logger';
import {
  canContainersRestart,
  composeFileExist,
  schemaName,
  generateDockerComposeFile,
  getMmrFile,
  getServicePort,
  nodeEndpoint,
  projectContainers,
  projectId,
  queryEndpoint,
  TemplateType,
} from 'src/utils/docker';
import { ProjectEvent } from 'src/utils/subscription';
import { projectConfigChanged } from 'src/utils/project';
import { IndexingStatus } from 'src/services/types';
import { DockerService } from 'src/services/docker.service';
import { SubscriptionService } from 'src/services/subscription.service';
import { DB } from 'src/db/db.module';

import { LogType, Project } from './project.model';

@Injectable()
export class ProjectService {
  private port: number;
  constructor(
    @InjectRepository(Project) private projectRepo: Repository<Project>,
    private pubSub: SubscriptionService,
    private docker: DockerService,
    private config: Config,
    private db: DB,
  ) {
    this.getLatestPort().then((port) => {
      this.port = port;
    });
  }

  async getLatestPort(): Promise<number> {
    const projects = await this.getProjects();
    if (projects.length === 0) return 3000;

    const ports = projects.map(({ queryEndpoint }) => getServicePort(queryEndpoint) ?? 3000);
    return Math.max(...ports);
  }

  async getProject(id: string): Promise<Project> {
    return this.projectRepo.findOne({ id });
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
      networkEndpoint: '',
      nodeEndpoint: '',
      queryEndpoint: '',
    });

    return this.projectRepo.save(project);
  }

  async updateProjectStatus(id: string, status: IndexingStatus): Promise<Project> {
    const project = await this.projectRepo.findOne({ id });
    project.status = status;
    return this.projectRepo.save(project);
  }

  // project management
  async startProject(
    id: string,
    networkEndpoint: string,
    networkDictionary: string,
    nodeVersion: string,
    queryVersion: string,
    poiEnabled: boolean,
    forceEnabled: boolean,
  ): Promise<Project> {
    let project = await this.getProject(id);
    if (!project) {
      project = await this.addProject(id);
    }

    const isDBExist = await this.db.checkSchemaExist(schemaName(id));
    const containers = await this.docker.ps(projectContainers(id));
    const isConfigChanged = projectConfigChanged(project, {
      networkEndpoint,
      networkDictionary,
      nodeVersion,
      queryVersion,
      poiEnabled,
      forceEnabled,
    });

    if (isDBExist && composeFileExist(id) && !isConfigChanged && canContainersRestart(id, containers)) {
      const restartedProject = await this.restartProject(id);
      return restartedProject;
    }

    const startedProject = await this.createAndStartProject(
      id,
      networkEndpoint,
      networkDictionary,
      nodeVersion,
      queryVersion,
      poiEnabled,
      forceEnabled,
    );

    return startedProject;
  }

  async createAndStartProject(
    id: string,
    networkEndpoint: string,
    networkDictionary: string,
    nodeVersion: string,
    queryVersion: string,
    poiEnabled: boolean,
    forceEnabled: boolean,
  ) {
    let project = await this.getProject(id);
    if (!project) await this.addProject(id);

    const projectID = projectId(id);
    const servicePort = getServicePort(project.queryEndpoint) ?? ++this.port;
    const nodeImageVersion = nodeVersion ?? 'v0.31.1';
    const queryImageVersion = queryVersion ?? 'v0.13.0';
    const postgres = this.config.postgres;

    const item: TemplateType = {
      deploymentID: id,
      projectID,
      networkEndpoint,
      servicePort,
      dictionary: networkDictionary,
      queryVersion: queryImageVersion,
      nodeVersion: nodeImageVersion,
      dbSchema: schemaName(id),
      poiEnabled,
      postgres,
    };

    try {
      await this.db.createDBSchema(schemaName(projectID));
      generateDockerComposeFile(item);
      await this.docker.up(item.deploymentID);
    } catch (e) {
      getLogger('project').info(`start project: ${e}`);
    }

    project = {
      id,
      networkEndpoint,
      networkDictionary,
      queryEndpoint: queryEndpoint(id, servicePort),
      nodeEndpoint: nodeEndpoint(id, servicePort),
      status: IndexingStatus.INDEXING,
      nodeVersion: nodeImageVersion,
      queryVersion,
      poiEnabled,
      forceEnabled,
    };

    this.pubSub.publish(ProjectEvent.ProjectStarted, { projectChanged: project });
    return this.projectRepo.save(project);
  }

  async stopProject(id: string) {
    const project = await this.getProject(id);
    if (!project) {
      getLogger('project').error(`project not exist: ${id}`);
      return;
    }

    getLogger('project').info(`stop project: ${id}`);
    this.docker.stop(projectContainers(id));
    this.pubSub.publish(ProjectEvent.ProjectStarted, { projectChanged: project });
    return this.updateProjectStatus(id, IndexingStatus.NOTINDEXING);
  }

  async restartProject(id: string) {
    getLogger('project').info(`restart project: ${id}`);
    this.docker.start(projectContainers(id));
    return this.updateProjectStatus(id, IndexingStatus.INDEXING);
  }

  async removeProject(id: string): Promise<Project[]> {
    getLogger('project').info(`remove project: ${id}`);

    const project = await this.getProject(id);
    if (!project) return [];

    const projectID = projectId(id);
    await this.docker.stop(projectContainers(id));
    await this.docker.rm(projectContainers(id));
    await this.db.dropDBSchema(schemaName(projectID));

    const mmrFile = getMmrFile(id);
    await this.docker.deleteFile(mmrFile);

    return this.projectRepo.remove([project]);
  }

  async logs(container: string): Promise<LogType> {
    const log = await this.docker.logs(container);
    return { log };
  }
}
