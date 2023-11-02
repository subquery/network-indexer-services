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
  ProjectSubqueryConfig,
  ProjectRpcConfig,
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
    const projectDetail = await this.projectService.getProjectDetails(id);
    return this.projectService.projectOrmToGql([projectDetail])[0];
  }

  @Query(() => [ProjectDetails])
  async getProjects(): Promise<ProjectDetails[]> {
    const projectDetails = await this.projectService.getProjects();
    return this.projectService.projectOrmToGql(projectDetails);
  }

  @Query(() => [Project])
  async getAliveProjects(): Promise<Project[]> {
    const projects = await this.projectService.getAliveProjects();
    return this.projectService.projectOrmToGql(projects);
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
    const project = await this.projectService.addProject(id);
    return this.projectService.projectOrmToGql([project])[0];
  }

  @Mutation(() => [Project])
  async removeSuqueryProject(@Args('id') id: string): Promise<Project[]> {
    const projects = await this.projectService.removeSubqueryProject(id);
    return this.projectService.projectOrmToGql(projects);
  }

  @Mutation(() => [Project])
  async removeRpcProject(@Args('id') id: string): Promise<Project[]> {
    const projects = await this.projectRpcService.removeRpcProject(id);
    return this.projectService.projectOrmToGql(projects);
  }

  // project management
  @Mutation(() => Project)
  async startSubqueryProject(
    @Args('id') id: string,
    @Args('projectConfig') projectConfig: ProjectSubqueryConfig
  ): Promise<Project> {
    const project = await this.projectService.startSubqueryProject(id, projectConfig);
    return this.projectService.projectOrmToGql([project])[0];
  }

  @Mutation(() => Project)
  async startRpcProject(
    @Args('id') id: string,
    @Args('projectConfig') projectConfig: ProjectRpcConfig
  ): Promise<Project> {
    const project = await this.projectRpcService.startRpcProject(id, projectConfig);
    return this.projectService.projectOrmToGql([project])[0];
  }

  @Mutation(() => Project)
  async stopSubqueryProject(@Args('id') id: string): Promise<Project> {
    const project = await this.projectService.stopSubqueryProject(id);
    return this.projectService.projectOrmToGql([project])[0];
  }

  @Mutation(() => Project)
  async stopRpcProject(@Args('id') id: string): Promise<Project> {
    const project = await this.projectRpcService.stopRpcProject(id);
    return this.projectService.projectOrmToGql([project])[0];
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
