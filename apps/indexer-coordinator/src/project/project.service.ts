// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { GraphqlQueryClient, IPFSClient, NETWORK_CONFIGS } from '@subql/network-clients';
import { argv } from 'src/yargs';
import { Not, Repository } from 'typeorm';

import { Config } from '../configure/configure.module';

import { AccountService } from '../core/account.service';
import { ContractService } from '../core/contract.service';
import { DockerService } from '../core/docker.service';
import { QueryService } from '../core/query.service';
import { DesiredStatus } from '../core/types';
import { DB } from '../db/db.module';
import { SubscriptionService } from '../subscription/subscription.service';
import {
  canContainersRestart,
  composeFileExist,
  generateDockerComposeFile,
  getServicePort,
  nodeEndpoint,
  projectContainers,
  projectId,
  queryEndpoint,
  schemaName,
} from '../utils/docker';
import { debugLogger, getLogger } from '../utils/logger';
import { nodeConfigs, projectConfigChanged, IPFS_URL } from '../utils/project';
import { GET_DEPLOYMENT, GET_INDEXER_PROJECTS } from '../utils/queries';
import { ProjectEvent } from '../utils/subscription';
import { PortService } from './port.service';
import {
  LogType,
  Payg,
  PaygConfig,
  PaygEntity,
  Project,
  ProjectAdvancedConfig,
  ProjectBaseConfig,
  ProjectDetails,
  ProjectEntity,
  ProjectInfo,
} from './project.model';
import { MmrStoreType, TemplateType } from './types';

@Injectable()
export class ProjectService {
  private client: GraphqlQueryClient;
  private ipfsClient: IPFSClient;

  constructor(
    @InjectRepository(ProjectEntity) private projectRepo: Repository<ProjectEntity>,
    @InjectRepository(PaygEntity) private paygRepo: Repository<PaygEntity>,
    private pubSub: SubscriptionService,
    private contract: ContractService,
    private query: QueryService,
    private docker: DockerService,
    private account: AccountService,
    private config: Config,
    private portService: PortService,
    private db: DB
  ) {
    this.client = new GraphqlQueryClient(NETWORK_CONFIGS[config.network]);
    this.ipfsClient = new IPFSClient(IPFS_URL);
    void this.restoreProjects();
  }

  getProject(id: string): Promise<Project> {
    return this.projectRepo.findOneBy({ id });
  }

  async getProjectDetails(id: string): Promise<ProjectDetails> {
    const project = await this.projectRepo.findOneBy({ id });
    if (!project) {
      throw new Error(`project not exist: ${id}`);
    }
    const payg = await this.paygRepo.findOneBy({ id });
    const metadata = await this.query.getQueryMetaData(id, project.queryEndpoint);

    return { ...project, metadata, payg };
  }

  async getProjects(): Promise<ProjectDetails[]> {
    const projects = await this.projectRepo.find();
    return Promise.all(projects.map(({ id }) => this.getProjectDetails(id)));
  }

  async getAliveProjects(): Promise<Project[]> {
    return this.projectRepo.find({ where: { queryEndpoint: Not('') } });
  }

  async getAllProjects(): Promise<Project[]> {
    return this.projectRepo.find();
  }

  async getAlivePaygs(): Promise<Payg[]> {
    // return this.paygRepo.find({ where: { price: Not('') } });
    // FIXME remove this
    const paygs = await this.paygRepo.find({ where: { price: Not('') } });
    for (const payg of paygs) {
      payg.overflow = 10000;
    }
    return paygs;
  }

  /// restore projects not `TERMINATED`
  async restoreProjects() {
    const indexer = await this.account.getIndexer();
    const networkClient = this.client.networkClient;
    if (!indexer) return;

    try {
      const result = await networkClient.query({
        // @ts-ignore
        query: GET_INDEXER_PROJECTS,
        variables: { indexer },
      });

      const projects = result.data.deploymentIndexers.nodes;
      const p = projects.filter(({ status }) => status !== 'TERMINATED');
      await Promise.all(p.map(({ deploymentId }) => this.addProject(deploymentId)));
    } catch (e) {
      debugLogger('project', `Failed to restore not terminated projects: ${String(e)}`);
    }
  }

  /// add project
  async getProjectInfo(id: string): Promise<ProjectInfo> {
    const networkClient = this.client.networkClient;
    const result = await networkClient.query({
      // @ts-ignore
      query: GET_DEPLOYMENT,
      variables: { id },
    });

    const deployment = result.data.deployment;
    const project = deployment.project;
    const metadataStr = await this.ipfsClient.cat(project.metadata);
    const versionStr = await this.ipfsClient.cat(deployment.version);
    const metadata = JSON.parse(metadataStr);
    const version = JSON.parse(versionStr);

    return {
      createdTimestamp: project.createdTimestamp,
      updatedTimestamp: deployment.createdTimestamp,
      owner: project.owner,
      ...metadata,
      ...version,
    };
  }

  async addProject(id: string): Promise<Project> {
    const project = await this.getProject(id);
    if (project) return project;
    const indexer = await this.account.getIndexer();
    const { status } = await this.contract.deploymentStatusByIndexer(id, indexer);
    const details = await this.getProjectInfo(id);
    const projectEntity = this.projectRepo.create({
      id: id.trim(),
      status,
      details,
    });

    const projectPayg = this.paygRepo.create({ id: id.trim() });
    await this.paygRepo.save(projectPayg);

    return this.projectRepo.save(projectEntity);
  }

  async updateProjectStatus(id: string, status: DesiredStatus): Promise<Project> {
    const project = await this.projectRepo.findOneBy({ id });
    project.status = status;
    return this.projectRepo.save(project);
  }

  // project management
  async startProject(
    id: string,
    baseConfig: ProjectBaseConfig,
    advancedConfig: ProjectAdvancedConfig
  ): Promise<Project> {
    let project = await this.getProject(id);
    if (!project) {
      project = await this.addProject(id);
    }

    this.setDefaultConfigValue(baseConfig);

    const isDBExist = await this.db.checkSchemaExist(schemaName(id));
    const containers = await this.docker.ps(projectContainers(id));
    const isConfigChanged = projectConfigChanged(project, baseConfig, advancedConfig);

    if (
      isDBExist &&
      composeFileExist(id) &&
      !isConfigChanged &&
      canContainersRestart(id, containers)
    ) {
      return await this.restartProject(id);
    }

    return await this.createAndStartProject(id, baseConfig, advancedConfig);
  }

  private setDefaultConfigValue(baseConfig: ProjectBaseConfig) {
    if (baseConfig.usePrimaryNetworkEndpoint === undefined) {
      baseConfig.usePrimaryNetworkEndpoint = true;
    }
  }

  async getMmrStoreType(id: string): Promise<MmrStoreType> {
    const schema = schemaName(id);
    const isDBExist = await this.db.checkSchemaExist(schema);
    if (!isDBExist) return MmrStoreType.postgres;

    const isMmrTableExist = await this.db.checkTableExist('_mmr', schema);
    if (isMmrTableExist) return MmrStoreType.postgres;

    return MmrStoreType.file;
  }

  async configToTemplate(
    project: Project,
    baseConfig: ProjectBaseConfig,
    advancedConfig: ProjectAdvancedConfig
  ): Promise<TemplateType> {
    const servicePort = this.portService.getAvailablePort();
    const mmrStoreType = await this.getMmrStoreType(project.id);
    const projectID = projectId(project.id);

    const postgres = this.config.postgres;
    const dockerNetwork = this.config.dockerNetwork;

    const mmrPath = argv['mmrPath'].replace(/\/$/, '');

    this.setDefaultConfigValue(baseConfig);

    const item: TemplateType = {
      deploymentID: project.id,
      dbSchema: schemaName(project.id),
      projectID,
      servicePort,
      postgres,
      mmrStoreType,
      dockerNetwork,
      ipfsUrl: IPFS_URL,
      mmrPath,
      ...baseConfig,
      ...advancedConfig,
      primaryNetworkEndpoint: baseConfig.networkEndpoints[0] || '',
    };

    return item;
  }

  async createAndStartProject(
    id: string,
    baseConfig: ProjectBaseConfig,
    advancedConfig: ProjectAdvancedConfig
  ) {
    let project = await this.getProject(id);
    if (!project) {
      project = await this.addProject(id);
    }

    const projectID = projectId(project.id);
    // TODO: recover `purgeDB` feature
    // if (advancedConfig.purgeDB) {
    //   await this.db.dropDBSchema(schemaName(projectID));
    // }

    // HOTFIX: purge poi
    const projectSchemaName = schemaName(projectID);
    const isDBExist = await this.db.checkSchemaExist(projectSchemaName);
    if (advancedConfig.purgeDB && isDBExist) {
      await this.db.clearMMRoot(projectSchemaName, 0);
    }

    const templateItem = await this.configToTemplate(project, baseConfig, advancedConfig);
    try {
      await this.db.createDBSchema(projectSchemaName);
      await generateDockerComposeFile(templateItem);
      await this.docker.up(templateItem.deploymentID);
    } catch (e) {
      getLogger('project').warn(e, `start project`);
    }

    const nodeConfig = await nodeConfigs(id);
    project.baseConfig = baseConfig;
    project.advancedConfig = advancedConfig;
    project.queryEndpoint = queryEndpoint(id, templateItem.servicePort);
    project.nodeEndpoint = nodeEndpoint(id, templateItem.servicePort);
    project.status = DesiredStatus.RUNNING;
    project.chainType = nodeConfig.chainType;

    await this.pubSub.publish(ProjectEvent.ProjectStarted, { projectChanged: project });
    return this.projectRepo.save(project);
  }

  async stopProject(id: string) {
    const project = await this.getProject(id);
    if (!project) {
      getLogger('project').error(`project not exist: ${id}`);
      return;
    }

    getLogger('project').info(`stop project: ${id}`);
    await this.docker.stop(projectContainers(id));
    await this.pubSub.publish(ProjectEvent.ProjectStarted, { projectChanged: project });
    return this.updateProjectStatus(id, DesiredStatus.STOPPED);
  }

  async restartProject(id: string) {
    getLogger('project').info(`restart project: ${id}`);
    await this.docker.start(projectContainers(id));
    return this.updateProjectStatus(id, DesiredStatus.RUNNING);
  }

  async removeProject(id: string): Promise<Project[]> {
    getLogger('project').info(`remove project: ${id}`);

    const project = await this.getProject(id);
    if (!project) return [];

    const projectID = projectId(id);
    await this.docker.stop(projectContainers(id));
    await this.docker.rm(projectContainers(id));
    await this.db.dropDBSchema(schemaName(projectID));

    // release port
    const port = getServicePort(project.queryEndpoint);
    this.portService.removePort(port);

    return this.projectRepo.remove([project]);
  }

  async updateProjectRateLimit(id: string, rateLimit: number): Promise<Project> {
    const project = await this.getProject(id);
    if (!project) {
      return;
    }
    project.rateLimit = rateLimit;
    return this.projectRepo.save(project);
  }

  async updateProjectPayg(id: string, paygConfig: PaygConfig) {
    const payg = await this.paygRepo.findOneBy({ id });
    if (!payg) {
      getLogger('project').error(`project not exist: ${id}`);
      throw new Error(`project not exist: ${id}`);
    }

    payg.price = paygConfig.price;
    payg.expiration = paygConfig.expiration;
    payg.threshold = paygConfig.threshold;
    payg.overflow = paygConfig.overflow;
    payg.token = paygConfig.token || this.contract.getSdk().sqToken.address;

    await this.pubSub.publish(ProjectEvent.ProjectStarted, { projectChanged: payg });
    return this.paygRepo.save(payg);
  }

  async logs(container: string): Promise<LogType> {
    const log = await this.docker.logs(container);
    return { log };
  }
}
