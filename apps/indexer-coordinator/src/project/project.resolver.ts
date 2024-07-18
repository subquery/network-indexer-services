// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Args, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';

import { DockerRegistry, DockerRegistryService } from '../core/docker.registry.service';
import { QueryService } from '../core/query.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { ProjectEvent } from '../utils/subscription';
import { DbStatsService } from './db.stats.service';
import { AggregatedManifest, RpcManifest } from './project.manifest';
import {
  LogType,
  MetadataType,
  Project,
  Payg,
  PaygConfig,
  ProjectDetails,
  ProjectConfig,
  ValidationResponse,
  ProjectInfo,
  ProjectWithStats,
} from './project.model';
import { ProjectRpcService } from './project.rpc.service';
import { ProjectService } from './project.service';
import { ProjectSubgraphService } from './project.subgraph.service';
import {
  ProjectType,
  SubgraphEndpoint,
  SubgraphPort,
  SubgraphPortType,
  SubqueryEndpointType,
} from './types';

@Resolver(() => Project)
export class ProjectResolver {
  constructor(
    private projectService: ProjectService,
    private projectRpcService: ProjectRpcService,
    private projectSubgraphService: ProjectSubgraphService,
    private queryService: QueryService,
    private dockerRegistry: DockerRegistryService,
    private pubSub: SubscriptionService,
    private dbStatsService: DbStatsService
  ) {}

  @Query(() => [String])
  getRegistryVersions(@Args('registry') registry: string, @Args('range') range: string) {
    return this.dockerRegistry.getRegistryVersions(registry as DockerRegistry, range);
  }

  @Query(() => MetadataType)
  async serviceMetadata(
    @Args('id') id: string,
    @Args('projectType', { nullable: true }) projectType?: ProjectType
  ) {
    let project: Project;
    if (projectType === undefined) {
      projectType = await this.projectService.getProjectType(id);
    }
    switch (projectType) {
      case ProjectType.SUBQUERY:
        project = await this.projectService.getProject(id);
        return this.queryService.getQueryMetaData(
          id,
          project?.serviceEndpoints?.find((e) => e.key === SubqueryEndpointType.Query)?.value
        );
      case ProjectType.RPC:
        return this.projectRpcService.getRpcMetadata(id);
      case ProjectType.SUBGRAPH:
        return this.projectSubgraphService.getSubgraphMetadata(id);
      default:
        throw new Error(`Unknown project type ${projectType}`);
    }
  }

  @Query(() => ProjectDetails)
  async project(@Args('id') id: string): Promise<ProjectDetails> {
    const project = await this.projectService.getProject(id);
    return {
      ...project,
      metadata: await this.serviceMetadata(id, project.projectType),
      payg: await this.projectService.getPayg(id),
    };
  }

  /**
   * // @deprecated use `getProjectsSimple` and `getProjectsMetadata` instead
   */
  // @Query(() => [ProjectDetails])
  // async getProjects(): Promise<ProjectDetails[]> {
  //   return this.projectService.getProjects();
  // }

  @Query(() => [Project])
  async getProjectsSimple(): Promise<Project[]> {
    return this.projectService.getAllProjects();
  }

  @Query(() => [ProjectDetails])
  async getProjectsMetadata(): Promise<ProjectDetails[]> {
    const projects = await this.projectService.getAllProjects();
    return Promise.all(
      projects.map(async (project) => {
        switch (project.projectType) {
          case ProjectType.SUBQUERY:
            return {
              ...project,
              metadata: await this.projectService.getSubqueryMetadata(project.id),
            };
          case ProjectType.RPC:
            return {
              ...project,
              metadata: await this.projectRpcService.getRpcMetadata(project.id),
            };
          case ProjectType.SUBGRAPH:
            return {
              ...project,
              metadata: await this.projectSubgraphService.getSubgraphMetadata(project.id),
            };
          default:
            throw new Error(`Unknown project type ${project.projectType}`);
        }
      })
    );
  }

  @Query(() => [ProjectWithStats])
  async getAliveProjects(): Promise<ProjectWithStats[]> {
    const projects: ProjectWithStats[] = [];
    const aliveProjects = await this.projectService.getAliveProjects();
    for (const project of aliveProjects) {
      if (project.projectType === ProjectType.SUBQUERY) {
        const dbSize = await this.dbStatsService.getProjectDbStats(project.id);
        projects.push({ ...project, dbSize: dbSize?.size });
      } else {
        const serviceEndpoints = project.serviceEndpoints;
        const manifest = project.manifest as RpcManifest;
        for (const endpoint of serviceEndpoints) {
          endpoint.isWebsocket = endpoint.key.endsWith('Ws');
          if (!manifest.rpcFamily || manifest.rpcFamily.length === 0) {
            continue;
          }
          if (endpoint.rpcFamily?.length > 0) {
            continue;
          }
          endpoint.rpcFamily = manifest.rpcFamily;
        }
        projects.push(project);
      }
    }
    return projects;
  }

  @Query(() => [Payg])
  getAlivePaygs() {
    return this.projectService.getAlivePaygs();
  }

  @Query(() => AggregatedManifest)
  async getManifest(
    @Args('projectId') projectId: string,
    @Args('projectType', { nullable: true }) projectType?: ProjectType
  ): Promise<AggregatedManifest> {
    const manifest = new AggregatedManifest();
    if (projectType === undefined) {
      projectType = await this.projectService.getProjectType(projectId);
    }
    switch (projectType) {
      case ProjectType.SUBQUERY:
        manifest.subqueryManifest = await this.projectService.getManifest(projectId);
        break;
      case ProjectType.RPC:
        manifest.rpcManifest = await this.projectService.getManifest(projectId);
        break;
      case ProjectType.SUBGRAPH:
        manifest.subgraphManifest = await this.projectService.getManifest(projectId);
        break;
      default:
        throw new Error(`Unknown project type ${projectType}`);
    }
    return manifest;
  }

  @Query(() => ProjectInfo)
  async getProjectInfo(@Args('projectId') projectId: string): Promise<ProjectInfo> {
    return this.projectService.getProjectInfoFromNetwork(projectId);
  }

  @Query(() => LogType)
  getLog(@Args('container') container: string) {
    return this.projectService.logs(container);
  }

  @Query(() => [String])
  async getRpcFamilyList(@Args('projectId') projectId: string) {
    return this.projectRpcService.getRpcFamilyList(projectId);
  }

  @Query(() => [String])
  async getRpcEndpointKeys(
    @Args('projectId') projectId: string
    // @Args('rpcFamily') rpcFamily: string
  ) {
    return this.projectRpcService.getAllEndpointKeys(
      await this.projectRpcService.getRpcFamilyList(projectId)
    );
  }

  @Query(() => ValidationResponse)
  async validateRpcEndpoint(
    @Args('projectId') projectId: string,
    @Args('endpointKey') endpointKey: string,
    @Args('endpoint') endpoint: string
  ) {
    return this.projectRpcService.validateRpcEndpoint(projectId, endpointKey, endpoint);
  }

  @Query(() => [String])
  getSubgraphPortTypes(): string[] {
    return this.projectSubgraphService.getRequiredPortsTypes();
  }

  @Query(() => [SubgraphEndpoint])
  async getSubgraphEndpoints(
    @Args('host') host: string,
    @Args('ports', { type: () => [SubgraphPort] }) ports: SubgraphPort[],
    @Args('cid') cid: string
  ): Promise<SubgraphEndpoint[]> {
    return this.projectSubgraphService.getSubgraphEndpoints(host, ports, cid);
  }

  @Mutation(() => Project)
  async addProject(@Args('id') id: string): Promise<Project> {
    return this.projectService.addProject(id);
  }

  // project management
  @Mutation(() => Project)
  async startProject(
    @Args('id') id: string,
    @Args('projectConfig') projectConfig: ProjectConfig,
    @Args('rateLimit', { nullable: true }) rateLimit?: number,
    @Args('projectType', { nullable: true }) projectType?: ProjectType
  ): Promise<Project> {
    if (projectType === undefined) {
      projectType = await this.projectService.getProjectType(id);
    }
    switch (projectType) {
      case ProjectType.SUBQUERY:
        return this.projectService.startSubqueryProject(id, projectConfig, rateLimit ?? 0);
      case ProjectType.RPC:
        return this.projectRpcService.startRpcProject(id, projectConfig, rateLimit ?? 0);
      case ProjectType.SUBGRAPH:
        return this.projectSubgraphService.startSubgraphProject(id, projectConfig, rateLimit ?? 0);
      default:
        throw new Error(`Unknown project type ${projectType}`);
    }
  }

  @Mutation(() => Project)
  async stopProject(
    @Args('id') id: string,
    @Args('projectType', { nullable: true }) projectType?: ProjectType
  ): Promise<Project> {
    if (projectType === undefined) {
      projectType = await this.projectService.getProjectType(id);
    }
    switch (projectType) {
      case ProjectType.SUBQUERY:
        return this.projectService.stopSubqueryProject(id);
      case ProjectType.RPC:
        return this.projectRpcService.stopRpcProject(id);
      case ProjectType.SUBGRAPH:
        return this.projectSubgraphService.stopSubgraphProject(id);
      default:
        throw new Error(`Unknown project type ${projectType}`);
    }
  }

  @Mutation(() => [Project])
  async removeProject(
    @Args('id') id: string,
    @Args('projectType', { nullable: true }) projectType?: ProjectType
  ): Promise<Project[]> {
    if (projectType === undefined) {
      projectType = await this.projectService.getProjectType(id);
    }
    switch (projectType) {
      case ProjectType.SUBQUERY:
        return this.projectService.removeSubqueryProject(id);
      case ProjectType.RPC:
        return this.projectRpcService.removeRpcProject(id);
      case ProjectType.SUBGRAPH:
        return this.projectSubgraphService.removeSubgraphProject(id);
      default:
        throw new Error(`Unknown project type ${projectType}`);
    }
  }

  @Mutation(() => Project)
  async updateProjectRateLimit(
    @Args('id') id: string,
    @Args('rateLimit') rateLimit: number
  ): Promise<Project> {
    return this.projectService.updateProjectRateLimit(id, rateLimit);
  }

  @Mutation(() => Payg)
  updateProjectPayg(@Args('id') id: string, @Args('paygConfig') paygConfig: PaygConfig) {
    return this.projectService.updateProjectPayg(id, paygConfig);
  }

  @Mutation(() => Boolean)
  async startProjectOnChain(@Args('id') id: string) {
    await this.projectService.startProjectOnChain(id);
    return true;
  }

  @Mutation(() => Boolean)
  async stopProjectOnChain(@Args('id') id: string) {
    await this.projectService.stopProjectOnChain(id);
    return true;
  }

  @Subscription(() => Project)
  projectChanged() {
    return this.pubSub.asyncIterator([ProjectEvent.ProjectStarted, ProjectEvent.ProjectStopped]);
  }

  @Query(() => String)
  async getProjectDbSize(@Args('id') id: string): Promise<string> {
    return (await this.dbStatsService.getProjectDbStats(id)).size || '0';
  }
}
