import { Logger, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import fetch from 'node-fetch';
import { Repository } from 'typeorm';
import { Project } from './project.model';
import { MetaData } from '@subql/common';
@Injectable()
export class ProjectService {
  constructor(
    @InjectRepository(Project) private projectRepo: Repository<Project>,
  ) {}

  async getProject(id: string): Promise<Project> {
    return this.projectRepo.findOne({ id });
  }

  async getIndexerMetaData(id: string): Promise<MetaData> {
    const project = await this.getProject(id);
    const { indexerEndpoint } = project;

    const response = await fetch(new URL(`meta`, indexerEndpoint));
    const result = await response.json();
    // FIXME: error handling
    return result;
  }

  async getQueryMetaData(id: string): Promise<MetaData> {
    const project = await this.getProject(id);
    const { queryEndpoint } = project;

    const queryBody = JSON.stringify({
      query: `{
        _metadata {
          lastProcessedHeight
          lastProcessedTimestamp
          targetHeight
          chain
          specName
          genesisHash
          indexerHealthy
          indexerNodeVersion
          queryNodeVersion
        }}`,
    });

    const response = await fetch(queryEndpoint, {
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      body: queryBody,
    });

    // FIXME: error handling
    const data = await response.json();
    return data.data._metadata;
  }

  async getProjects(): Promise<Project[]> {
    return this.projectRepo.find();
  }

  async getIndexingProjects() {
    return this.projectRepo.find({
      where: [
        { status: 1 },
        { status: 2 },
      ]
    });
  }

  async addProject(id: string, indexerEndpoint: string): Promise<Project> {
    const project = this.projectRepo.create({
      id,
      status: 1,
      indexerEndpoint,
      queryEndpoint: '',
      blockHeight: 0,
    });
    return this.projectRepo.save(project);
  }

  async updateProject(
    id: string,
    indexerEndpoint?: string,
    queryEndpoint?: string,
  ): Promise<Project> {
    const project = await this.projectRepo.findOne({ id });
    if (indexerEndpoint) {
      project.indexerEndpoint = indexerEndpoint;
    }
    if (queryEndpoint) {
      project.queryEndpoint = queryEndpoint;
    }

    return this.projectRepo.save(project);
  }
}
