// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Ollama } from 'ollama';
import { DesiredStatus } from 'src/core/types';
import { getLogger } from 'src/utils/logger';
import { Repository } from 'typeorm';
import { SubscriptionService } from '../subscription/subscription.service';
import { LLMManifest } from './project.manifest';
import {
  IProjectConfig,
  MetadataType,
  Project,
  ProjectEntity,
  SeviceEndpoint,
  ValidationResponse,
} from './project.model';
import { ProjectService } from './project.service';
import {
  LLMEndpointAccessType,
  LLMEndpointType,
  LLMModel,
  LLMModelPullResult,
  LLMModelStatus,
} from './types';

const logger = getLogger('project.llm.service');

@Injectable()
export class ProjectLLMService {
  private pullingProgress = new Map<string, LLMModelPullResult[]>();

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
    if (project.rateLimit !== rateLimit) {
      project.rateLimit = rateLimit;
    }
    const host = new URL(projectConfig.serviceEndpoints[0].value).toString();
    const targetModel = (project.manifest as LLMManifest).model.name;
    const normalizedModel = this.normalizeModelName(targetModel);

    try {
      const ollama = new Ollama({ host });
      const allModels = await ollama.list();

      const model = allModels?.models?.find((m) => m.name === normalizedModel);
      if (!model) {
        if (!this.getOnPullingModels(host).find((m) => m.name === normalizedModel)) {
          project.status = DesiredStatus.PULLING;

          ollama
            .pull({ model: normalizedModel, stream: true })
            .then(async (stream) => {
              for await (const part of stream) {
                this.updatePullingProgress(host, { name: normalizedModel, ...part });
              }
              this.removePullingProgress(host, normalizedModel);
              project.status = DesiredStatus.RUNNING;
              await this.projectRepo.save(project);
            })
            .catch((err) => {
              this.removePullingProgress(host, normalizedModel);
              logger.error(`${id} pull model:${normalizedModel} host: ${host} failed: ${err.message}`);
            });
        }
      }
    } catch (err) {
      logger.error(`startLLMProject id: ${id} failed: ${err.message}`);
    }

    project.projectConfig = projectConfig;
    project.serviceEndpoints = [
      new SeviceEndpoint(
        LLMEndpointType.ApiGenerateEndpoint,
        this.nodeEndpoint(host, '/v1/chat/completions'),
        LLMEndpointAccessType[LLMEndpointType.ApiGenerateEndpoint]
      ),
    ];
    return await this.projectRepo.save(project);
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
    const host = endpoints[0]?.value;
    const manifest = project.manifest as LLMManifest;
    const targetModel = manifest?.model?.name;
    if (host && targetModel) {
      const ollama = new Ollama({ host });
      await ollama.delete({ model: targetModel });
    }
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

  async getModels(host: string): Promise<LLMModel[]> {
    const res = [];
    try {
      host = new URL(host).toString();
      const ollama = new Ollama({ host });

      const downloadedModels = await ollama.list();
      const loadedModels = await ollama.ps();
      const pullingModels = this.getOnPullingModels(host);

      const loadedModelNames = loadedModels?.models?.map((m) => m.name);

      downloadedModels?.models?.forEach((m) => {
        res.push({
          name: m.name,
          size: m.size,
          digest: m.digest,
          status: loadedModelNames.find((lm) => lm === m.name)
            ? LLMModelStatus.LOADED
            : LLMModelStatus.NORMAL,
        });
      });

      pullingModels.forEach((m) => {
        res.push({ name: m.name, status: LLMModelStatus.PULLING, pullStatus: m });
      });
    } catch (err) {
      logger.error(`getModels host: ${host} failed: ${err.message}`);
    }
    return res;
  }

  async deleteModel(host: string, model: string): Promise<void> {
    host = new URL(host).toString();
    model = this.normalizeModelName(model);
    const ollama = new Ollama({ host });
    await ollama.delete({ model });
  }

  pullModel(host: string, model: string): void {
    host = new URL(host).toString();
    const ollama = new Ollama({ host });
    ollama
      .pull({ model, stream: true })
      .then(async (stream) => {
        for await (const part of stream) {
          console.log(part);
          this.updatePullingProgress(host, { name: model, ...part });
        }
        this.removePullingProgress(host, model);
      })
      .catch((err) => {
        this.removePullingProgress(host, model);
        logger.error(`pull model:${model} host: ${host} failed: ${err.message}`);
      });
  }

  async getLLMMetadata(id: string): Promise<MetadataType> {
    const project = await this.projectService.getProject(id);
    if (!project) {
      return;
    }
    const manifest = project.manifest as LLMManifest;
    const model = manifest?.model?.name;
    const endpoints = project.projectConfig.serviceEndpoints;
    const host = endpoints[0]?.value;

    let m = null;
    if (model && host) {
      m = await this.getModel(host, model);
    }

    return {
      startHeight: 0,
      lastHeight: 0,
      lastTime: 0,
      targetHeight: 0,
      healthy: true,
      chain: '',
      specName: '',
      genesisHash: '',
      indexerNodeVersion: '',
      queryNodeVersion: '',
      indexerStatus: '',
      queryStatus: '',
      model: m,
    };
  }

  private updatePullingProgress(host: string, part: LLMModelPullResult) {
    const progress = this.pullingProgress.get(host) || [];
    const index = progress.findIndex((p) => p.name === part.name);
    if (index >= 0) {
      progress[index] = part;
    } else {
      progress.push(part);
    }
    this.pullingProgress.set(host, progress);
  }

  async getModel(host: string, model: string): Promise<LLMModel> {
    const res: LLMModel = {
      name: model,
      status: LLMModelStatus.NOT_READY,
    };
    try {
      const normalizedModel = this.normalizeModelName(model);
      host = new URL(host).toString();
      const pullingModels = this.getOnPullingModels(host);
      const pullingModel = pullingModels.find((m) => m.name === normalizedModel);
      if (pullingModels.find((m) => m.name === normalizedModel)) {
        res.status = LLMModelStatus.PULLING;
        res.pullStatus = pullingModel;
        return res;
      }
      const ollama = new Ollama({ host });
      const downloadedModels = await ollama.list();
      const loadedModels = await ollama.ps();

      if (downloadedModels?.models?.find((m) => m.name === normalizedModel)) {
        res.status = LLMModelStatus.NORMAL;
      }
      if (loadedModels.models?.find((lm) => lm.name === normalizedModel)) {
        res.status = LLMModelStatus.LOADED;
      }
    } catch (err) {
      logger.error(`getModel host: ${host} model: ${model} failed: ${err.message}`);
    }
    return res;
  }

  // todo: remove
  getPullingProgress(host: string, model: string): LLMModelPullResult {
    host = new URL(host).toString();
    model = this.normalizeModelName(model);
    const progress = this.pullingProgress.get(host) || [];
    return progress.find((p) => p.name === model);
  }

  private getOnPullingModels(host: string): LLMModelPullResult[] {
    return this.pullingProgress.get(host) || [];
  }

  private removePullingProgress(host: string, model: string) {
    const progress = this.pullingProgress.get(host) || [];
    const index = progress.findIndex((p) => p.name === model);
    if (index >= 0) {
      progress.splice(index, 1);
    }
    if (progress.length === 0) {
      this.pullingProgress.delete(host);
    } else {
      this.pullingProgress.set(host, progress);
    }
  }

  inspectPullingProgress(): LLMModelPullResult[] {
    const res = [];
    for (const [host, pulls] of this.pullingProgress.entries()) {
      for (const pull of pulls) {
        res.push({ host, ...pull });
      }
    }
    console.log('inspectPullingProgress:', res);
    return res;
  }

  nodeEndpoint(host: string, input: string): string {
    const url = new URL(input, host);
    return url.toString();
  }

  normalizeModelName(model: string): string {
    if (model.lastIndexOf(':') === -1) {
      return model + ':latest';
    }
    return model;
  }
}
