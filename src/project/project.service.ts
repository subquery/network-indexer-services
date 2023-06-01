// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import {Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {GraphqlQueryClient, IPFS_URLS, IPFSClient, NETWORK_CONFIGS} from '@subql/network-clients';
import {Not, Repository} from 'typeorm';

import {AccountService} from '../account/account.service';
import {Config} from '../configure/configure.module';
import {DB} from '../db/db.module';

import {ContractService} from '../services/contract.service';
import {DockerService} from '../services/docker.service';
import {QueryService} from '../services/query.service';
import {IndexingStatus} from '../services/types';
import {SubscriptionService} from '../subscription/subscription.service';
import {
  canContainersRestart,
  composeFileExist,
  configsWithNode,
  generateDockerComposeFile,
  getServicePort,
  nodeEndpoint,
  projectContainers,
  projectId,
  queryEndpoint,
  schemaName,
  TemplateType,
} from '../utils/docker';
import {debugLogger, getLogger} from '../utils/logger';
import {projectConfigChanged} from '../utils/project';
import {GET_DEPLOYMENT, GET_INDEXER_PROJECTS} from '../utils/queries';
import {ProjectEvent} from '../utils/subscription';
import {PortService} from './port.service';
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
    private db: DB,
  ) {
    this.client = new GraphqlQueryClient(NETWORK_CONFIGS[config.network]);
    this.ipfsClient = new IPFSClient(IPFS_URLS.project);
    void this.restoreProjects();
  }

  async getProject(id: string): Promise<Project> {
    return this.projectRepo.findOne({ id });
  }

  async getProjectDetails(id: string): Promise<ProjectDetails> {
    const project = await this.projectRepo.findOne({ id });
    const metadata = await this.query.getQueryMetaData(id, project.queryEndpoint);

    return { ...project, metadata };
  }

  async getProjects(): Promise<ProjectDetails[]> {
    const projects = await this.projectRepo.find();
    return Promise.all(projects.map(({ id }) => this.getProjectDetails(id)));
  }

  async getAliveProjects(): Promise<Project[]> {
    return this.projectRepo.find({ where: { queryEndpoint: Not('') } });
  }

  async getAlivePaygs(): Promise<Payg[]> {
    return this.paygRepo.find({ where: { price: Not('') } });
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

    const { status } = await this.contract.deploymentStatusByIndexer(id);
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
      return await this.restartProject(id);
    }

    return await this.createAndStartProject(id, baseConfig, advancedConfig);
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
    const dockerNetwork = this.config.dockerNetwork;

    const item: TemplateType = {
      deploymentID: project.id,
      dbSchema: schemaName(project.id),
      projectID,
      servicePort,
      postgres,
      dockerNetwork,
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
    if (advancedConfig.purgeDB) {
      await this.db.clearMMRoot(projectSchemaName, 0);
    }

    const templateItem = await this.configToTemplate(project, baseConfig, advancedConfig);
    try {
      await this.db.createDBSchema(projectSchemaName);
      await generateDockerComposeFile(templateItem);
      await this.docker.up(templateItem.deploymentID);
    } catch (e) {
      getLogger('project').warn(e,`start project`);
    }

    //TODO: remove this after confirm other chains suppor POI feature
    const config = await configsWithNode({ id, poiEnabled: advancedConfig.poiEnabled });
    project.baseConfig = baseConfig;
    project.advancedConfig = advancedConfig;
    project.queryEndpoint = queryEndpoint(id, templateItem.servicePort);
    project.nodeEndpoint = nodeEndpoint(id, templateItem.servicePort);
    project.status = IndexingStatus.INDEXING;
    project.chainType = config.chainType;

    await this.pubSub.publish(ProjectEvent.ProjectStarted, {projectChanged: project});
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
    await this.pubSub.publish(ProjectEvent.ProjectStarted, {projectChanged: project});
    return this.updateProjectStatus(id, IndexingStatus.NOTINDEXING);
  }

  async restartProject(id: string) {
    getLogger('project').info(`restart project: ${id}`);
    await this.docker.start(projectContainers(id));
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

    // release port
    const port = getServicePort(project.queryEndpoint);
    this.portService.removePort(port);

    return this.projectRepo.remove([project]);
  }

  async updateProjectPayg(id: string, paygConfig: PaygConfig) {
    const payg = await this.paygRepo.findOne({ id });
    if (!payg) {
      getLogger('project').error(`project not exist: ${id}`);
      return;
    }

    payg.price = paygConfig.price;
    payg.expiration = paygConfig.expiration;
    payg.threshold = paygConfig.threshold;
    payg.overflow = paygConfig.overflow;

    await this.pubSub.publish(ProjectEvent.ProjectStarted, {projectChanged: payg});
    return this.paygRepo.save(payg);
  }

  async logs(container: string): Promise<LogType> {
    const log = await this.docker.logs(container);
    return { log };
  }
}
