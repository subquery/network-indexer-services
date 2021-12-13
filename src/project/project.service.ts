// Copyright 2020-2021 OnFinality Limited authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import fetch from 'node-fetch';
import { Repository, Not, IsNull } from 'typeorm';
import { Project } from './project.model';
import { MetaData } from '@subql/common';
@Injectable()
export class ProjectService {
  constructor(@InjectRepository(Project) private projectRepo: Repository<Project>) {}

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

  async getAliveProjects(): Promise<Project[]> {
    return this.projectRepo.find({
      where: {
        queryEndpoint: Not(''),
      },
    });
  }

  async getIndexingProjects() {
    return this.projectRepo.find({
      where: [{ status: 1 }, { status: 2 }],
    });
  }

  async addProject(id: string): Promise<Project> {
    const project = this.projectRepo.create({
      id,
      status: 0,
      indexerEndpoint: '',
      queryEndpoint: '',
      blockHeight: 0,
    });
    return this.projectRepo.save(project);
  }

  async startProject(id: string, indexerEndpoint: string): Promise<Project> {
    return this.updateProject(id, indexerEndpoint);
  }

  async updateProjectToReady(id: string, queryEndpoint: string): Promise<Project> {
    return this.updateProject(id, undefined, queryEndpoint);
  }

  async updateProject(
    id: string,
    indexerEndpoint?: string,
    queryEndpoint?: string,
  ): Promise<Project> {
    const project = await this.projectRepo.findOne({ id });
    if (indexerEndpoint) {
      project.indexerEndpoint = indexerEndpoint;
      // FIXME: shoudn't update status here
      project.status = 1;
    }
    if (queryEndpoint) {
      project.queryEndpoint = queryEndpoint;
      project.status = 2;
    }

    return this.projectRepo.save(project);
  }

  async stopProject(id: string): Promise<Project> {
    const project = await this.projectRepo.findOne({ id });
    project.status = 3;
    return this.projectRepo.save(project);
  }

  async removeProject(id: string): Promise<Project[]> {
    const project = await this.getProject(id);
    return this.projectRepo.remove([project]);
  }

  async removeProjects(): Promise<Project[]> {
    const projects = await this.getProjects();
    return this.projectRepo.remove(projects);
  }
}
