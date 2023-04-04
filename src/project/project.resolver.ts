// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Args, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';

import { ProjectEvent } from 'src/utils/subscription';
import { SubscriptionService } from 'src/subscription/subscription.service';
import { QueryService } from 'src/services/query.service';
import { DockerRegistry, DockerRegistryService } from 'src/services/docker.registry.service';

import { LogType, MetadataType, ProjectAdvancedConfig, ProjectBaseConfig, Project } from './project.model';
import { ProjectService } from './project.service';

@Resolver(() => Project)
export class ProjectResolver {
  constructor(
    private projectService: ProjectService,
    private queryService: QueryService,
    private dockerRegistry: DockerRegistryService,
    private pubSub: SubscriptionService,
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

  @Query(() => Project)
  project(@Args('id') id: string) {
    return this.projectService.getProject(id);
  }

  @Query(() => [Project])
  getProjects() {
    return this.projectService.getProjects();
  }

  @Query(() => [Project])
  getAliveProjects() {
    return this.projectService.getAliveProjects();
  }

  @Query(() => LogType)
  getLog(@Args('container') container: string) {
    return this.projectService.logs(container);
  }

  @Mutation(() => Project)
  addProject(@Args('id') id: string) {
    return this.projectService.addProject(id);
  }

  @Mutation(() => [Project])
  removeProject(@Args('id') id: string) {
    return this.projectService.removeProject(id);
  }

  // project management
  @Mutation(() => Project)
  startProject(
    @Args('id') id: string,
    @Args('baseConfig') baseConfig: ProjectBaseConfig,
    @Args('advancedConfig') advancedConfig: ProjectAdvancedConfig,
  ) {
    return this.projectService.startProject(id, baseConfig, advancedConfig);
  }

  @Mutation(() => Project)
  stopProject(@Args('id') id: string) {
    return this.projectService.stopProject(id);
  }

  @Mutation(() => Project)
  paygProject(
    @Args('id') id: string,
    @Args('paygPrice') paygPrice: string,
    @Args('paygExpiration') paygExpiration: number,
    @Args('paygThreshold') paygThreshold: number,
    @Args('paygOverflow') paygOverflow: number,
  ) {
    return this.projectService.paygProject(id, paygPrice, paygExpiration, paygThreshold, paygOverflow);
  }

  @Subscription(() => Project)
  projectChanged() {
    return this.pubSub.asyncIterator([ProjectEvent.ProjectStarted, ProjectEvent.ProjectStopped]);
  }
}
