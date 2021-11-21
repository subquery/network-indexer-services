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
  addProject(@Args('id') id: string, @Args('indexerEndpoint') endpoint: string) {
    return this.projectService.addProject(id, endpoint);
  }

  @Mutation(() => ProjectType)
  updateProject(
    @Args('id') id: string,
    @Args('indexerEndpoint') indexerEndpoint?: string,
    @Args('queryEndpoint') queryEndpoint?: string,
  ) {
    return this.projectService.updateProject(id, indexerEndpoint, queryEndpoint);
  }
}
