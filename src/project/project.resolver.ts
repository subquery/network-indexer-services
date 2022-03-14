// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Args, Mutation, Query, Resolver, Subscription } from '@nestjs/graphql';
import { SubscriptionService } from './subscription.service';
import { ProjectService } from './project.service';
import { ProjectType } from './project.model';
import { ProjectEvent } from 'src/utils/subscription';
import { DockerService } from './docker.service';

@Resolver(() => ProjectType)
export class ProjectResolver {
  constructor(
    private projectService: ProjectService,
    private pubSub: SubscriptionService,
    private docker: DockerService,
  ) { }

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

  @Query(() => String)
  getLog(@Args('container') container: string) {
    return this.docker.logs(container);
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
  startProject(@Args('id') id: string, @Args('networkEndpoint') networkEndpoint: string) {
    return this.projectService.startProject(id, networkEndpoint);
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
