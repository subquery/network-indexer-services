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
} from './project.model';
import { ProjectRpcService } from './project.rpc.service';
import { ProjectService } from './project.service';

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

  @Mutation(() => Project)
  async addProject(@Args('id') id: string): Promise<Project> {
    return this.projectService.addProject(id);
  }

  @Mutation(() => [Project])
  async removeSuqueryProject(@Args('id') id: string): Promise<Project[]> {
    return this.projectService.removeSubqueryProject(id);
  }

  @Mutation(() => [Project])
  async removeRpcProject(@Args('id') id: string): Promise<Project[]> {
    return this.projectRpcService.removeRpcProject(id);
  }

  // project management
  @Mutation(() => Project)
  async startSubqueryProject(
    @Args('id') id: string,
    @Args('projectConfig') projectConfig: ProjectConfig
  ): Promise<Project> {
    return this.projectService.startSubqueryProject(id, projectConfig);
  }

  @Mutation(() => Project)
  async startRpcProject(
    @Args('id') id: string,
    @Args('projectConfig') projectConfig: ProjectConfig
  ): Promise<Project> {
    return this.projectRpcService.startRpcProject(id, projectConfig);
  }

  @Mutation(() => Project)
  async stopSubqueryProject(@Args('id') id: string): Promise<Project> {
    return this.projectService.stopSubqueryProject(id);
  }

  @Mutation(() => Project)
  async stopRpcProject(@Args('id') id: string): Promise<Project> {
    return this.projectRpcService.stopRpcProject(id);
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
