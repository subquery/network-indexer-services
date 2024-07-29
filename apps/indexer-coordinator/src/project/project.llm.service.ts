// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Ollama } from 'ollama';
import { getLogger } from 'src/utils/logger';
import { OllamaEvent } from 'src/utils/subscription';
import { Repository } from 'typeorm';
import { SubscriptionService } from '../subscription/subscription.service';
import { LLMManifest } from './project.manifest';
import { IProjectConfig, Project, ProjectEntity, ValidationResponse } from './project.model';
import { ProjectService } from './project.service';
import { DesiredStatus } from 'src/core/types';

const logger = getLogger('project.llm.service');

@Injectable()
export class ProjectLLMService {
  constructor(
    @InjectRepository(ProjectEntity) private projectRepo: Repository<ProjectEntity>,
    private projectService: ProjectService,
    private pubSub: SubscriptionService
  ) {}

  async startLLMProject(
    id: string,
    projectConfig: IProjectConfig,
    rateLimit: number
  ): Promise<Project> {
    let project = await this.projectService.getProject(id);
    if (!project) {
      project = await this.projectService.addProject(id);
    }
    const endpoints = projectConfig.serviceEndpoints;
    const host = endpoints[0].value;

    const manifest = project.manifest as LLMManifest;
    const targetModel = manifest.model.name;

    try {
      const ollama = new Ollama({ host });
      const allModels = await ollama.list();

      const model = allModels?.models?.find((m) => m.name === targetModel);
      if (!model) {
        ollama.pull({ model: targetModel, stream: true }).then(async (stream) => {
          for await (const part of stream) {
            // console.log(part);
            this.pubSub.publish(OllamaEvent.PullProgress, part);
          }
        });
      }
    } catch (err) {
      logger.error(`validate llm host: ${host} failed: ${err.message}`);
      throw new Error(`Failed to start LLM project: ${err.message}`);
    }
    return project;
  }

  async stopLLMProject(id: string): Promise<Project> {
    const project = await this.projectService.getProject(id);
    if (!project) {
      return;
    }
    project.status = DesiredStatus.STOPPED;
    return this.projectRepo.save(project);
  }

  async removeLLMProject(id: string): Promise<Project[]> {
    const project = await this.projectService.getProject(id);
    if (!project) return [];
    const endpoints = project.serviceEndpoints;
    const host = endpoints[0].value;

    const manifest = project.manifest as LLMManifest;
    const targetModel = manifest.model.name;

    const ollama = new Ollama({ host });
    await ollama.delete({ model: targetModel });

    return this.projectRepo.remove([project]);
  }

  async validate(host): Promise<ValidationResponse> {
    try {
      const ollama = new Ollama({ host });
      await ollama.list();
      return { valid: true, reason: '' };
    } catch (err) {
      logger.error(`validate llm host: ${host} failed: ${err.message}`);
      return { valid: false, reason: err.message };
    }
  }
}
