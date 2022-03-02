// Copyright 2020-2021 OnFinality Limited authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ProjectService } from './project.service';
import { ProjectType, ServiceMetaDataType } from './project.model';
import { Logger } from '@nestjs/common';

@Resolver(() => ProjectType)
export class ProjectResolver {
  constructor(private projectService: ProjectService) { }
  private readonly logger = new Logger(ProjectService.name);

  @Query(() => ProjectType)
  project(@Args('id') id: string) {
    return this.projectService.getProject(id);
  }

  @Query(() => ServiceMetaDataType)
  queryMetaData(@Args('id') id: string) {
    return this.projectService.getQueryMetaData(id);
  }

  @Query(() => ServiceMetaDataType)
  indexerMetaData(@Args('id') id: string) {
    return this.projectService.getIndexerMetaData(id);
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

  @Mutation(() => ProjectType)
  updateProjectServices(
    @Args('id') id: string,
    @Args('indexerEndpoint') indexerUrl: string,
    @Args('queryEndpoint') queryUrl: string,
  ) {
    return this.projectService.updateProjectServices(id, indexerUrl, queryUrl);
  }

  @Mutation(() => ProjectType)
  updateProjectStatus(@Args('id') id: string, @Args('status') status: number) {
    return this.projectService.updateProjectStatus(id, status);
  }

  @Mutation(() => [ProjectType])
  removeProject(@Args('id') id: string) {
    return this.projectService.removeProject(id);
  }

  @Mutation(() => [ProjectType])
  removeProjects() {
    return this.projectService.removeProjects();
  }

  // project management
  @Query(() => ProjectType)
  createAndStartProject(@Args('id') id: string) {
    return this.projectService.createAndStartProject(id);
  }

  @Query(() => ProjectType)
  restartProject(@Args('id') id: string) {
    return this.projectService.restartProject(id);
  }

  @Query(() => ProjectType)
  stopProject(@Args('id') id: string) {
    return this.projectService.stopProject(id);
  }
}
