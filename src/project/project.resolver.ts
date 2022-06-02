// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Args, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';
import { SubscriptionService } from './subscription.service';
import { ProjectService } from './project.service';
import { LogType, MetadataType, ProjectType } from './project.model';
import { ProjectEvent } from 'src/utils/subscription';
import { QueryService } from './query.service';
import { DockerRegistry, DockerRegistryService } from './docker.registry.service';

@Resolver(() => ProjectType)
export class ProjectResolver {
  constructor(
    private projectService: ProjectService,
    private queryService: QueryService,
    private dockerRegistry: DockerRegistryService,
    private pubSub: SubscriptionService,
  ) { }

  @Query(() => [String])
  getRegistryVersions(@Args('registry') registry: string, @Args('range') range: string) {
    return this.dockerRegistry.getRegistryVersions(registry as DockerRegistry, range);
  }

  @Query(() => MetadataType)
  queryMetadata(@Args('id') id: string) {
    return this.queryService.getQueryMetaData(id);
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

  @Subscription(() => ProjectType)
  projectChanged() {
    return this.pubSub.asyncIterator([ProjectEvent.ProjectStarted, ProjectEvent.ProjectStopped]);
  }
}
