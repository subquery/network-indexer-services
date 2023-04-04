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
  configsWithNode,
} from 'src/utils/docker';
import { PortService } from './port.service';
import { ProjectEvent } from 'src/utils/subscription';
import { projectConfigChanged } from 'src/utils/project';
import { IndexingStatus } from 'src/services/types';
import { DockerService } from 'src/services/docker.service';
import { SubscriptionService } from 'src/subscription/subscription.service';
import { DB } from 'src/db/db.module';

import { LogType, ProjectEntity, Project, ProjectBaseConfig, ProjectAdvancedConfig } from './project.model';
import { getYargsOption } from 'src/yargs';

@Injectable()
export class ProjectService {
  private ports: number[];
  constructor(
    @InjectRepository(ProjectEntity) private projectRepo: Repository<ProjectEntity>,
    private pubSub: SubscriptionService,
    private docker: DockerService,
    private config: Config,
    private portService: PortService,
    private db: DB,
  ) {}

  getMmrPath() {
    const { argv } = getYargsOption();
    return argv['mmrPath'].replace(/\/$/, '');
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
      id: id.trim(),
      status: 0,
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
    baseConfig: ProjectBaseConfig,
    advancedConfig: ProjectAdvancedConfig,
  ): Promise<Project> {
    let project = await this.getProject(id);
    if (!project) {
      project = await this.addProject(id);
    }

    const isDBExist = await this.db.checkSchemaExist(schemaName(id));
    const containers = await this.docker.ps(projectContainers(id));
    const isConfigChanged = projectConfigChanged(project, baseConfig, advancedConfig);

    if (isDBExist && composeFileExist(id) && !isConfigChanged && canContainersRestart(id, containers)) {
      const restartedProject = await this.restartProject(id);
      return restartedProject;
    }

    const startedProject = await this.createAndStartProject(id, baseConfig, advancedConfig);

    return startedProject;
  }

  async configToTemplate(
    project: Project,
    baseConfig: ProjectBaseConfig,
    advancedConfig: ProjectAdvancedConfig,
  ): Promise<TemplateType> {
    const port = await this.portService.getAvailablePort();
    const servicePort = getServicePort(project.queryEndpoint) ?? port;
    const projectID = projectId(project.id);

    const postgres = this.config.postgres;
    const mmrPath = this.getMmrPath();

    const item: TemplateType = {
      deploymentID: project.id,
      dbSchema: schemaName(project.id),
      projectID,
      servicePort,
      postgres,
      mmrPath,
      ...baseConfig,
      ...advancedConfig,
    };

    return item;
  }

  async createAndStartProject(
    id: string,
    baseConfig: ProjectBaseConfig,
    advancedConfig: ProjectAdvancedConfig,
  ) {
    let project = await this.getProject(id);
    if (!project) await this.addProject(id);

    const projectID = projectId(project.id);
    if (advancedConfig.purgeDB) {
      await this.db.dropDBSchema(schemaName(projectID));
      const mmrFile = getMmrFile(this.getMmrPath(), id);
      await this.docker.deleteFile(mmrFile);
    }

    const templateItem = await this.configToTemplate(project, baseConfig, advancedConfig);
    try {
      await this.db.createDBSchema(schemaName(projectID));
      await generateDockerComposeFile(templateItem);
      await this.docker.up(templateItem.deploymentID);
    } catch (e) {
      getLogger('project').info(`start project: ${e}`);
    }

    //TODO: remove this after confirm other chains suppor POI feature
    const config = await configsWithNode({ id, poiEnabled: advancedConfig.poiEnabled });
    project = {
      id,
      baseConfig,
      advancedConfig,
      queryEndpoint: queryEndpoint(id, templateItem.servicePort),
      nodeEndpoint: nodeEndpoint(id, templateItem.servicePort),
      status: IndexingStatus.INDEXING,
      chainType: config.chainType,
    };

    this.pubSub.publish(ProjectEvent.ProjectStarted, { projectChanged: project });
    return this.projectRepo.save(project);
  }

  // paygPrice: '', // default is none
  // paygExpiration: 3600,
  // paygThreshold: 1000,
  // paygOverflow: 5,

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

    // release port
    const port = getServicePort(project.queryEndpoint);
    this.portService.removePort(port);

    const projectID = projectId(id);
    await this.docker.stop(projectContainers(id));
    await this.docker.rm(projectContainers(id));
    await this.db.dropDBSchema(schemaName(projectID));

    const mmrFile = getMmrFile(this.getMmrPath(), id);
    await this.docker.deleteFile(mmrFile);

    return this.projectRepo.remove([project]);
  }

  // async paygProject(
  //   id: string,
  //   paygPrice: string,
  //   paygExpiration: number,
  //   paygThreshold: number,
  //   paygOverflow: number,
  // ) {
  //   const project = await this.getProject(id);
  //   if (!project) {
  //     getLogger('project').error(`project not exist: ${id}`);
  //     return;
  //   }
  //   // TODO more check with price
  //   project.paygPrice = paygPrice;
  //   project.paygExpiration = paygExpiration;
  //   project.paygThreshold = paygThreshold;
  //   project.paygOverflow = paygOverflow;
  //   this.pubSub.publish(ProjectEvent.ProjectStarted, { projectChanged: project });
  //   return this.projectRepo.save(project);
  // }

  async logs(container: string): Promise<LogType> {
    const log = await this.docker.logs(container);
    return { log };
  }
}
