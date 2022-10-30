// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Args, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';

import { ProjectEvent } from 'src/utils/subscription';
import { SubscriptionService } from 'src/subscription/subscription.service';
import { QueryService } from 'src/services/query.service';
import { DockerRegistry, DockerRegistryService } from 'src/services/docker.registry.service';

import { LogType, MetadataType, ProjectType } from './project.model';
import { ProjectService } from './project.service';

@Resolver(() => ProjectType)
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

  @Query(() => ProjectType)
  project(@Args('id') id: string) {
    return this.projectService.getProject(id);
  }

  @Query(() => [ProjectType])
  getProjects() {
    return this.projectService.getProjects();
  }

  @Query(() => [ProjectType])
  getAliveProjects() {
    return this.projectService.getAliveProjects();
  }

  @Query(() => LogType)
  getLog(@Args('container') container: string) {
    return this.projectService.logs(container);
  }

  @Mutation(() => ProjectType)
  addProject(@Args('id') id: string) {
    return this.projectService.addProject(id);
  }

  @Mutation(() => [ProjectType])
  removeProject(@Args('id') id: string) {
    return this.projectService.removeProject(id);
  }

  // project management
  @Mutation(() => ProjectType)
  startProject(
    @Args('id') id: string,
    @Args('networkEndpoint') networkEndpoint: string,
    @Args('networkDictionary') networkDictionary: string,
    @Args('nodeVersion') nodeVersion: string,
    @Args('queryVersion') queryVersion: string,
    @Args('poiEnabled') poiEnabled: boolean,
    @Args('forceEnabled') forceEnabled: boolean,
  ) {
    return this.projectService.startProject(
      id,
      networkEndpoint,
      networkDictionary,
      nodeVersion,
      queryVersion,
      poiEnabled,
      forceEnabled,
    );
  }

  @Mutation(() => ProjectType)
  stopProject(@Args('id') id: string) {
    return this.projectService.stopProject(id);
  }

  @Mutation(() => ProjectType)
  paygProject(
    @Args('id') id: string,
    @Args('paygPrice') paygPrice: string,
    @Args('paygExpiration') paygExpiration: number,
    @Args('paygThreshold') paygThreshold: number,
    @Args('paygOverflow') paygOverflow: number,
  ) {
    return this.projectService.paygProject(id, paygPrice, paygExpiration, paygThreshold, paygOverflow);
  }

  @Subscription(() => ProjectType)
  projectChanged() {
    return this.pubSub.asyncIterator([ProjectEvent.ProjectStarted, ProjectEvent.ProjectStopped]);
  }
}
