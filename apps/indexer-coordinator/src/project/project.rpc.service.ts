// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DesiredStatus } from 'src/core/types';
import { getLogger } from 'src/utils/logger';
import { getDomain, getIpAddress, isIp, isPrivateIp } from 'src/utils/network';
import { Repository } from 'typeorm';
import { RpcManifest } from './project.manifest';
import {
  IProjectConfig,
  MetadataType,
  Project,
  ProjectEntity,
  ValidationResponse,
} from './project.model';
import { ProjectService } from './project.service';
import { getRpcFamilyObject } from './rpc.factory';
import { ProjectType } from './types';

const logger = getLogger('project.rpc.service');

@Injectable()
export class ProjectRpcService {
  constructor(
    @InjectRepository(ProjectEntity) private projectRepo: Repository<ProjectEntity>,
    private projectService: ProjectService
  ) {}

  @Cron('0 */8 * * * *')
  async autoValidateRpcEndpoints() {
    const projects = (await this.projectService.getAliveProjects()).filter(
      (project) => project.projectType === ProjectType.RPC
    );
    for (const project of projects) {
      for (const endpoint of project.serviceEndpoints) {
        const response = await this.validateRpcEndpoint(project.id, endpoint.key, endpoint.value);
        if (!response.valid) {
          logger.warn(
            `Project ${project.id} endpoint ${endpoint.key} is invalid: ${response.reason}`
          );
        }
        endpoint.valid = response.valid;
        endpoint.reason = response.reason;
      }
    }
    await this.projectRepo.save(projects);
  }

  async getRpcFamilyList(projectId: string): Promise<string[]> {
    let project = await this.projectService.getProject(projectId);
    if (!project) {
      project = await this.projectService.addProject(projectId);
    }
    const manifest = project.manifest as RpcManifest;
    return manifest.rpcFamily || [];
  }

  getEndpointKeys(rpcFamily: string): string[] {
    const family = getRpcFamilyObject(rpcFamily);
    if (!family) return [];

    // TODO return family.getEndpointKeys();
    return family.getEndpointKeys().filter((key) => key.endsWith('Http'));
  }

  getAllEndpointKeys(rpcFamilyList: string[]): string[] {
    return rpcFamilyList.map((family) => this.getEndpointKeys(family)).flat();
  }

  async validateRpcEndpoint(
    projectId: string,
    endpointKey: string,
    endpoint: string
  ): Promise<ValidationResponse> {
    // should be internal ip
    try {
      const domain = getDomain(endpoint);
      if (!domain) {
        return this.formatResponse(false, 'Invalid domain');
      }
      let ip: string;
      if (isIp(domain)) {
        ip = domain;
      } else {
        ip = await getIpAddress(domain);
      }
      if (!ip) {
        return this.formatResponse(false, 'Invalid ip address');
      }
      if (!isPrivateIp(ip)) {
        return this.formatResponse(false, 'Endpoint is not private ip');
      }
    } catch (e) {
      logger.error(e);
      return this.formatResponse(false, e.message);
    }

    // compare chain id, genesis hash, rpc family, client name and version, node type
    try {
      let project = await this.projectService.getProject(projectId);
      if (!project) {
        project = await this.projectService.addProject(projectId);
      }
      const projectManifest = project.manifest as RpcManifest;
      const rpcFamily = projectManifest.rpcFamily.find((family) => endpointKey.startsWith(family));
      // const protocolType = endpointKey.replace(rpcFamily, '').toLowerCase();
      await getRpcFamilyObject(rpcFamily)
        .withChainId(projectManifest.chain?.chainId)
        .withGenesisHash(projectManifest.chain?.genesisHash)
        .withNodeType(projectManifest.nodeType)
        .withClientNameAndVersion(projectManifest.client?.name, projectManifest.client?.version)
        .validate(endpoint);
      return this.formatResponse(true);
    } catch (e) {
      logger.debug(e);
      return this.formatResponse(false, e.message);
    }
  }

  formatResponse(valid = false, reason = ''): ValidationResponse {
    return {
      valid,
      reason,
    };
  }

  async startRpcProject(
    id: string,
    projectConfig: IProjectConfig,
    rateLimit: number
  ): Promise<Project> {
    let project = await this.projectService.getProject(id);
    if (!project) {
      project = await this.projectService.addProject(id);
    }
    project.projectConfig = projectConfig;
    project.status = DesiredStatus.RUNNING;
    project.rateLimit = rateLimit;

    const manifest = project.manifest as RpcManifest;
    const endpointKeys = this.getAllEndpointKeys(manifest.rpcFamily || []);

    project.serviceEndpoints = projectConfig.serviceEndpoints.filter((endpoint) => {
      return endpointKeys.includes(endpoint.key);
    });

    return this.projectRepo.save(project);
  }

  async stopRpcProject(id: string): Promise<Project> {
    const project = await this.projectService.getProject(id);
    if (!project) {
      return;
    }
    project.status = DesiredStatus.STOPPED;
    return this.projectRepo.save(project);
  }

  async removeRpcProject(id: string): Promise<Project[]> {
    const project = await this.projectService.getProject(id);
    if (!project) {
      return [];
    }
    return this.projectRepo.remove([project]);
  }

  async getRpcMetadata(id: string): Promise<MetadataType> {
    const project = await this.projectService.getProject(id);
    if (!project) {
      return;
    }
    const manifest = project.manifest as RpcManifest;
    // TODO: support multiple rpc family
    const rpcFamily = manifest.rpcFamily[0];
    const family = getRpcFamilyObject(rpcFamily);
    const key = family.getEndpointKeys().find((key) => key.endsWith('Http'));
    const endpoint = project.serviceEndpoints.find((endpoint) => endpoint.key === key);
    const startHeight = 0;
    let lastHeight = 0;
    let lastTime = 0;
    let targetHeight = 0;
    try {
      if (family && endpoint) {
        // startHeight = await family.getStartHeight(endpoint.value);
        lastHeight = await family.getLastHeight(endpoint.value);
        lastTime = await family.getLastTimestamp(endpoint.value);
        targetHeight = (await family.getTargetHeight(endpoint.value)) || lastHeight;
      }
    } catch (e) {
      logger.debug(`getRpcMetadata error: ${e}`);
    }
    return {
      startHeight,
      lastHeight,
      lastTime,
      targetHeight,
      healthy: !!endpoint?.valid,
      chain: manifest.chain.chainId,
      specName: '',
      genesisHash: manifest.chain.genesisHash,
      indexerNodeVersion: '',
      queryNodeVersion: '',
      indexerStatus: '',
      queryStatus: '',
    };
  }
}
