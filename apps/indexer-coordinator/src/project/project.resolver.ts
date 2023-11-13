// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Args, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';

import { DockerRegistry, DockerRegistryService } from '../core/docker.registry.service';
import { QueryService } from '../core/query.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { ProjectEvent } from '../utils/subscription';

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
  async queryMetadata(@Args('id') id: string) {
    const project = await this.projectService.getProject(id);
    return this.queryService.getQueryMetaData(id, project?.queryEndpoint);
  }

  @Query(() => ProjectDetails)
  async project(@Args('id') id: string): Promise<ProjectDetails> {
    return this.projectService.getProjectDetails(id);
  }

  @Query(() => [ProjectDetails])
  async getProjects(): Promise<ProjectDetails[]> {
    return this.projectService.getProjects();
  }

  @Query(() => [Project])
  async getAliveProjects(): Promise<Project[]> {
    return this.projectService.getAliveProjects();
  }

  @Query(() => [Payg])
  getAlivePaygs() {
    return this.projectService.getAlivePaygs();
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
  getRpcEndpointKeys(
    // @Args('projectId') projectId: string,
    @Args('rpcFamily') rpcFamily: string
  ) {
    return this.projectRpcService.getEndpointKeys(rpcFamily);
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
        return [];
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
        return undefined;
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
        return undefined;
    }
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
