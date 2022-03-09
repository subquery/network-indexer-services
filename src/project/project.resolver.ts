// Copyright 2020-2021 OnFinality Limited authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ProjectService } from './project.service';
import { ProjectType } from './project.model';
import { Logger } from '@nestjs/common';

@Resolver(() => ProjectType)
export class ProjectResolver {
  constructor(private projectService: ProjectService) { }
  private readonly logger = new Logger(ProjectService.name);

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
}
