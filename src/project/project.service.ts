// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';

import { Project } from './project.model';
import { IndexingStatus } from './types';
import { getLogger } from 'src/utils/logger';
import { DockerService } from './docker.service';
import {
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
    this.port = 3000;
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
  async startProject(deploymentID: string, networkEndpoint: string): Promise<Project> {
    let project = await this.getProject(deploymentID);
    if (!project) {
      project = await this.addProject(deploymentID);
    }

    // restart the project if project already exist and network endpoint keep same
    if (project.networkEndpoint === networkEndpoint) {
      const restartedProject = await this.restartProject(deploymentID);
      return restartedProject;
    }

    // create and start new project if the project not start before
    const projectID = projectId(deploymentID);
    const servicePort = getServicePort(project.queryEndpoint) ?? ++this.port;
    const item: TemplateType = {
      deploymentID,
      projectID,
      networkEndpoint,
      servicePort,
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
      id: deploymentID,
      networkEndpoint,
      queryEndpoint: queryEndpoint(deploymentID, servicePort),
      nodeEndpoint: nodeEndpoint(deploymentID, servicePort),
      status: IndexingStatus.INDEXING,
    };

    this.pubSub.publish(ProjectEvent.ProjectStarted, { projectChanged: project });
    return this.projectRepo.save(project);
  }

  async stopProject(deploymentID: string) {
    const project = await this.getProject(deploymentID);
    if (!project) {
      getLogger('docker').error(`project not exist: ${deploymentID}`);
      return;
    }

    getLogger('docker').info(`stop project: ${deploymentID}`);
    this.docker.stop(projectContainers(deploymentID));
    this.pubSub.publish(ProjectEvent.ProjectStarted, { projectChanged: project });
    return this.updateProjectStatus(deploymentID, IndexingStatus.NOTINDEXING);
  }

  async restartProject(deploymentID: string) {
    getLogger('docker').info(`restart project: ${deploymentID}`);
    this.docker.start(projectContainers(deploymentID));
    return this.updateProjectStatus(deploymentID, IndexingStatus.INDEXING);
  }

  async removeProject(id: string): Promise<Project[]> {
    const project = await this.getProject(id);
    return this.projectRepo.remove([project]);
  }

  async removeProjects(): Promise<Project[]> {
    const projects = await this.getProjects();
    return this.projectRepo.remove(projects);
  }
}
