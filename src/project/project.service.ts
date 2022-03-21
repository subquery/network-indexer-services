// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';

import { LogType, Project } from './project.model';
import { IndexingStatus } from './types';
import { getLogger } from 'src/utils/logger';
import { DockerService } from './docker.service';
import {
  dbName,
  generateDockerComposeFile,
  getServicePort,
  nodeEndpoint,
  projectContainers,
  projectId,
  queryEndpoint,
  TemplateType,
} from 'src/utils/docker';
import { SubscriptionService } from './subscription.service';
import { ProjectEvent } from 'src/utils/subscription';

@Injectable()
export class ProjectService {
  private port: number;
  constructor(
    @InjectRepository(Project) private projectRepo: Repository<Project>,
    private pubSub: SubscriptionService,
    private docker: DockerService,
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

  // FIXME: filter alive project with status
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
  ): Promise<Project> {
    let project = await this.getProject(id);
    if (!project) {
      project = await this.addProject(id);
    }

    // restart the project if project already exist and network endpoint keep same
    const isDBExist = await this.docker.checkDBExist(dbName(id));
    const containers = await this.docker.ps(projectContainers(id));
    const isContainersExist = containers.split('\n').length == projectContainers.length;
    if (project.networkEndpoint === networkEndpoint && isContainersExist && isDBExist) {
      const restartedProject = await this.restartProject(id);
      return restartedProject;
    }

    const startedProject = await this.createAndStartProject(id, networkEndpoint, networkDictionary);
    return startedProject;
  }

  async createAndStartProject(id: string, networkEndpoint: string, networkDictionary: string) {
    let project = await this.getProject(id);
    const projectID = projectId(id);
    const servicePort = getServicePort(project.queryEndpoint) ?? ++this.port;
    const item: TemplateType = {
      deploymentID: id,
      projectID,
      networkEndpoint,
      servicePort,
      dictionary: networkDictionary,
      nodeVersion: 'v0.29.1', // TODO: image versions will be included in the manifest
      queryVersion: 'v0.12.0', // file in the future version of subqul sdk
    };

    try {
      await this.docker.createDB(`db_${projectID}`);
      generateDockerComposeFile(item);
      await this.docker.up(item.deploymentID);
    } catch (e) {
      getLogger('docker').error(`start project failed: ${e}`);
    }

    project = {
      id,
      networkEndpoint,
      queryEndpoint: queryEndpoint(id, servicePort),
      nodeEndpoint: nodeEndpoint(id, servicePort),
      status: IndexingStatus.INDEXING,
    };

    this.pubSub.publish(ProjectEvent.ProjectStarted, { projectChanged: project });
    return this.projectRepo.save(project);
  }

  async stopProject(id: string) {
    const project = await this.getProject(id);
    if (!project) {
      getLogger('docker').error(`project not exist: ${id}`);
      return;
    }

    getLogger('docker').info(`stop project: ${id}`);
    this.docker.stop(projectContainers(id));
    this.pubSub.publish(ProjectEvent.ProjectStarted, { projectChanged: project });
    return this.updateProjectStatus(id, IndexingStatus.NOTINDEXING);
  }

  async restartProject(id: string) {
    getLogger('docker').info(`restart project: ${id}`);
    this.docker.start(projectContainers(id));
    return this.updateProjectStatus(id, IndexingStatus.INDEXING);
  }

  async removeProject(id: string): Promise<Project[]> {
    const project = await this.getProject(id);
    return this.projectRepo.remove([project]);
  }

  async removeProjects(): Promise<Project[]> {
    const projects = await this.getProjects();
    return this.projectRepo.remove(projects);
  }

  async logs(container: string): Promise<LogType> {
    const log = await this.docker.logs(container);
    return { log };
  }
}
