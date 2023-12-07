// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Args, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';

import { DockerRegistry, DockerRegistryService } from '../core/docker.registry.service';
import { QueryService } from '../core/query.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { ProjectEvent } from '../utils/subscription';
import { AggregatedManifest } from './project.manifest';
import {
  LogType,
  MetadataType,
  Project,
  Payg,
  PaygConfig,
  ProjectDetails,
  ProjectConfig,
  ValidationResponse,
} from './project.model';
import { ProjectRpcService } from './project.rpc.service';
import { ProjectService } from './project.service';
import { ProjectType } from './types';

@Resolver(() => Project)
export class ProjectResolver {
  constructor(
    private projectService: ProjectService,
    private projectRpcService: ProjectRpcService,
    private queryService: QueryService,
    private dockerRegistry: DockerRegistryService,
    private pubSub: SubscriptionService
  ) {}

  @Query(() => [String])
  getRegistryVersions(@Args('registry') registry: string, @Args('range') range: string) {
    return this.dockerRegistry.getRegistryVersions(registry as DockerRegistry, range);
  }

  @Query(() => MetadataType)
  async serviceMetadata(@Args('id') id: string, @Args('projectType') projectType: ProjectType) {
    let project: Project;
    switch (projectType) {
      case ProjectType.SUBQUERY:
        project = await this.projectService.getProject(id);
        return this.queryService.getQueryMetaData(id, project?.queryEndpoint);
      case ProjectType.RPC:
        return this.projectRpcService.getRpcMetadata(id);
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
   * @deprecated use `getProjectsSimple` and `getProjestsMetadata` instead
   */
  @Query(() => [ProjectDetails])
  async getProjects(): Promise<ProjectDetails[]> {
    return this.projectService.getProjects();
  }

  @Query(() => [Project])
  async getProjectsSimple(): Promise<Project[]> {
    return this.projectService.getAllProjects();
  }

  @Query(() => [ProjectDetails])
  async getProjestsMetadata(): Promise<ProjectDetails[]> {
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
          default:
            throw new Error(`Unknown project type ${project.projectType}`);
        }
      })
    );
  }

  @Query(() => [Project])
  async getAliveProjects(): Promise<Project[]> {
    return this.projectService.getAliveProjects();
  }

  @Query(() => [Payg])
  getAlivePaygs() {
    return this.projectService.getAlivePaygs();
  }

  @Query(() => AggregatedManifest)
  async getManifest(
    @Args('projectId') projectId: string,
    @Args('projectType') projectType: ProjectType
  ): Promise<AggregatedManifest> {
    const manifest = new AggregatedManifest();
    switch (projectType) {
      case ProjectType.SUBQUERY:
        manifest.subqueryManifest = await this.projectService.getManifest(projectId);
        break;
      case ProjectType.RPC:
        manifest.rpcManifest = await this.projectService.getManifest(projectId);
        break;
      default:
        throw new Error(`Unknown project type ${projectType}`);
    }
    return manifest;
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

  @Mutation(() => Project)
  async addProject(@Args('id') id: string): Promise<Project> {
    return this.projectService.addProject(id);
  }

  @Mutation(() => [Project])
  async removeProject(
    @Args('id') id: string,
    @Args('projectType') projectType: ProjectType
  ): Promise<Project[]> {
    switch (projectType) {
      case ProjectType.SUBQUERY:
        return this.projectService.removeSubqueryProject(id);
      case ProjectType.RPC:
        return this.projectRpcService.removeRpcProject(id);
      default:
        throw new Error(`Unknown project type ${projectType}`);
    }
  }

  // project management
  @Mutation(() => Project)
  async startProject(
    @Args('id') id: string,
    @Args('projectType') projectType: ProjectType,
    @Args('projectConfig') projectConfig: ProjectConfig
  ): Promise<Project> {
    switch (projectType) {
      case ProjectType.SUBQUERY:
        return this.projectService.startSubqueryProject(id, projectConfig);
      case ProjectType.RPC:
        return this.projectRpcService.startRpcProject(id, projectConfig);
      default:
        throw new Error(`Unknown project type ${projectType}`);
    }
  }

  @Mutation(() => Project)
  async stopProject(
    @Args('id') id: string,
    @Args('projectType') projectType: ProjectType
  ): Promise<Project> {
    switch (projectType) {
      case ProjectType.SUBQUERY:
        return this.projectService.stopSubqueryProject(id);
      case ProjectType.RPC:
        return this.projectRpcService.stopRpcProject(id);
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

  @Subscription(() => Project)
  projectChanged() {
    return this.pubSub.asyncIterator([ProjectEvent.ProjectStarted, ProjectEvent.ProjectStopped]);
  }
}
