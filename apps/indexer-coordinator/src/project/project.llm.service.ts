// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import fetch from 'node-fetch';
import { DesiredStatus } from 'src/core/types';
import { getLogger } from 'src/utils/logger';
import { AbortableAsyncIterator, Ollama, normalizeModelName } from 'src/utils/ollama';
import { Repository } from 'typeorm';
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

async function fetchAdapter(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  let url: string;
  if (input instanceof URL) {
    url = input.toString();
  } else if (typeof input === 'string') {
    url = input;
  } else {
    url = input.url;
  }

  const r = await fetch(url, {
    method: init.method,
    headers: init?.headers as any,
    body: init?.body as any,
  });

  // const t = await r.text();
  const sstream: NodeJS.ReadableStream = r.body;

  const dstream: ReadableStream<Uint8Array> = new ReadableStream<Uint8Array>({
    start(controller) {
      sstream.on('readable', function () {
        let data;
        while ((data = this.read()) !== null) {
          console.log('data:', data.toString());
          controller.enqueue(data);
        }
      });
      sstream.on('end', () => {
        console.log('end');
        controller.close();
      });
      sstream.on('error', (err) => {
        console.log('error:', err);
        controller.error(err);
      });
    },
    cancel(reason) {
      if ((sstream as any).destroy) {
        (sstream as any).destroy.destroy(new Error(reason));
      }
    },
  });
  const res = new Response(dstream, {
    headers: r.headers as any,
    status: r.status,
    statusText: r.statusText,
  });
  return res;
}

@Injectable()
export class ProjectLLMService {
  private ongoingStreamedRequests: AbortableAsyncIterator[] = [];

  constructor(
    @InjectRepository(ProjectEntity) private projectRepo: Repository<ProjectEntity>,
    private projectService: ProjectService
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
    const host = projectConfig.serviceEndpoints[0].value;
    const targetModel = (project.manifest as LLMManifest).model.name;

    try {
      this.pullModel(host, targetModel);
    } catch (err) {
      logger.error(`startLLMProject id: ${id} failed: ${err.message}`);
    }

    project.status = DesiredStatus.RUNNING;
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
    model = normalizeModelName(model);

    try {
      const ollama = new Ollama({ host });
      await ollama.delete({ model });
    } catch (err) {}
    const onPulling = this.ongoingStreamedRequests.find((iterator) => {
      return iterator.meta.host === host && iterator.meta.model === model;
    });
    onPulling?.abort();
  }

  async pullModel(host: string, model: string): Promise<void> {
    host = new URL(host).toString();
    model = normalizeModelName(model);

    const onPulling = this.ongoingStreamedRequests.find((iterator) => {
      return iterator.meta.host === host && iterator.meta.model === model;
    });
    if (onPulling) {
      return;
    }

    const ollama = new Ollama({ host });
    const allModels = await ollama.list();

    const existModel = allModels?.models?.find((m) => m.name === model);
    if (existModel) {
      return;
    }
    let it: AbortableAsyncIterator;
    ollama
      .pull({ model, stream: true })
      .then(async (iterator) => {
        it = iterator;
        this.addOngoinStreamedRequests(iterator);
        for await (const message of iterator) {
          iterator.updateProgress({ name: model, ...message });
        }
        this.removeOngoingStreamedRequests(it);
      })
      .catch((err) => {
        this.removeOngoingStreamedRequests(it);
        logger.error(`pull error model:${model} host: ${host} failed: ${err.message}`);
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

  async getModel(host: string, model: string): Promise<LLMModel> {
    const res: LLMModel = {
      name: model,
      status: LLMModelStatus.NOT_READY,
    };
    try {
      const normalizedModel = normalizeModelName(model);
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
    model = normalizeModelName(model);

    const onPulling = this.ongoingStreamedRequests.find((iterator) => {
      return iterator.meta.host === host && iterator.meta.model === model;
    });
    return onPulling?.meta.progress;
  }

  private getOnPullingModels(host: string): LLMModelPullResult[] {
    const res = [];
    for (const iter of this.ongoingStreamedRequests) {
      if (iter.meta.host === host && iter.meta.progress) {
        res.push(iter.meta.progress);
      }
    }
    return res;
  }

  private addOngoinStreamedRequests(iterator: AbortableAsyncIterator) {
    this.ongoingStreamedRequests.push(iterator);
  }

  private removeOngoingStreamedRequests(iterator: AbortableAsyncIterator) {
    const i = this.ongoingStreamedRequests.indexOf(iterator);
    if (i > -1) {
      this.ongoingStreamedRequests.splice(i, 1);
    }
  }

  inspectOngoingStreamedRequests() {
    const res = [];
    for (const it of this.ongoingStreamedRequests) {
      res.push(it.meta);
    }
    return res;
  }

  nodeEndpoint(host: string, input: string): string {
    const url = new URL(input, host);
    return url.toString();
  }
}
