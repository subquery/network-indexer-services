import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ProjectService } from './project.service';
import { ProjectType, MetaDataType } from './project.model';
import { Logger } from '@nestjs/common';

@Resolver(() => ProjectType)
export class ProjectResolver {
  constructor(private projectService: ProjectService) {}
  private readonly logger = new Logger(ProjectService.name);

  @Query(() => ProjectType)
  project(@Args('id') id: string) {
    return this.projectService.getProject(id);
  }

  @Query(() => MetaDataType)
  queryMetaData(@Args('id') id: string) {
    return this.projectService.getQueryMetaData(id);
  }

  @Query(() => MetaDataType)
  indexerMetaData(@Args('id') id: string) {
    return this.projectService.getIndexerMetaData(id);
  }

  @Query(() => [ProjectType])
  getProjects() {
    return this.projectService.getProjects();
  }

  @Mutation(() => ProjectType)
  addProject(@Args('id') id: string) {
    return this.projectService.addProject(id);
  }

  @Mutation(() => ProjectType)
  startProject(@Args('id') id: string, @Args('indexerEndpoint') endpoint: string) {
    return this.projectService.startProject(id, endpoint);
  }

  @Mutation(() => ProjectType)
  updateProjectToReady(@Args('id') id: string, @Args('queryEndpoint') endpoint: string) {
    return this.projectService.updateProjectToReady(id, endpoint);
  }

  @Mutation(() => ProjectType)
  stopProject(@Args('id') id: string) {
    return this.projectService.stopProject(id);
  }
}
