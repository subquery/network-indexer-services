// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
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
  SeviceEndpoint,
  ValidationResponse,
} from './project.model';
import { ProjectService } from './project.service';
import { RequiredRpcType, getRpcFamilyObject } from './rpc.factory';
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
      await this.validateProjectEndpoints(project, project.serviceEndpoints);
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

  private getEndpointKeys(rpcFamily: string): string[] {
    const family = getRpcFamilyObject(rpcFamily);
    if (!family) return [];

    return family.getEndpointKeys();
    // return family.getEndpointKeys().filter((key) => key.endsWith('Http'));
  }

  getAllEndpointKeys(rpcFamilyList: string[]): string[] {
    return rpcFamilyList.map((family) => this.getEndpointKeys(family)).flat();
  }

  private async validateProjectEndpoints(
    project: Project,
    serviceEndpoints: SeviceEndpoint[]
  ): Promise<ValidationResponse> {
    const validateUrlResult = this.validateRpcEndpointsUrl(serviceEndpoints);
    serviceEndpoints = serviceEndpoints.filter((endpoint) => endpoint.value);
    let reason = '';
    for (const endpoint of serviceEndpoints) {
      if (!validateUrlResult.valid) {
        endpoint.valid = false;
        endpoint.reason = validateUrlResult.reason;
        reason = reason || validateUrlResult.reason;
        continue;
      }
      const response = await this.validateRpcEndpoint(project.id, endpoint.key, endpoint.value);
      if (!response.valid) {
        logger.warn(
          `Project ${project.id} endpoint ${endpoint.key} is invalid: ${response.reason}`
        );
      }
      endpoint.valid = response.valid;
      endpoint.reason = response.reason;
      reason = reason || response.reason;
    }
    return this.formatResponse(!reason, reason);
  }

  private validateRpcEndpointsUrl(serviceEndpoints: SeviceEndpoint[]): ValidationResponse {
    if (!serviceEndpoints || serviceEndpoints.length === 0) {
      return this.formatResponse(false, 'No endpoints');
    }
    const rpcFamily = serviceEndpoints[0].key.replace(/(Http|Ws)$/, '');
    if (serviceEndpoints.length > 1) {
      const rpcFamily2 = serviceEndpoints[1].key.replace(/(Http|Ws)$/, '');
      if (rpcFamily !== rpcFamily2) {
        return this.formatResponse(false, 'Endpoints are not from the same rpc family');
      }
      try {
        const host1 = new URL(serviceEndpoints[0].value).hostname;
        const host2 = new URL(serviceEndpoints[1].value).hostname;
        if (host1 !== host2) {
          return this.formatResponse(false, 'Endpoints are not from the same host');
        }
      } catch (e) {
        return this.formatResponse(false, 'Invalid url');
      }
    }
    for (const endpoint of serviceEndpoints) {
      if (
        endpoint.key.endsWith('Http') &&
        !(endpoint.value.startsWith('http://') || endpoint.value.startsWith('https://'))
      ) {
        return this.formatResponse(false, 'Invalid http endpoint');
      }
      if (
        endpoint.key.endsWith('Ws') &&
        !(endpoint.value.startsWith('ws://') || endpoint.value.startsWith('wss://'))
      ) {
        return this.formatResponse(false, 'Invalid ws endpoint');
      }
    }
    return this.validateRequiredRpcType(rpcFamily, serviceEndpoints);
  }

  private validateRequiredRpcType(
    rpcFamily: string,
    serviceEndpoints: SeviceEndpoint[]
  ): ValidationResponse {
    const rpcType = getRpcFamilyObject(rpcFamily).getRequiredRpcType();
    switch (rpcType) {
      case RequiredRpcType.http:
        if (!serviceEndpoints.find((endpoint) => endpoint.key.endsWith('Http'))) {
          return this.formatResponse(false, 'Missing http endpoint');
        }
        break;
      case RequiredRpcType.ws:
        if (!serviceEndpoints.find((endpoint) => endpoint.key.endsWith('Ws'))) {
          return this.formatResponse(false, 'Missing ws endpoint');
        }
        break;
      case RequiredRpcType.any:
        if (
          !serviceEndpoints.find(
            (endpoint) => endpoint.key.endsWith('Http') || endpoint.key.endsWith('Ws')
          )
        ) {
          return this.formatResponse(false, 'Missing http or ws endpoint');
        }
        break;
      case RequiredRpcType.both:
        if (
          !serviceEndpoints.find((endpoint) => endpoint.key.endsWith('Http')) ||
          !serviceEndpoints.find((endpoint) => endpoint.key.endsWith('Ws'))
        ) {
          return this.formatResponse(false, 'Missing http and ws endpoint');
        }
        break;
      default:
        return this.formatResponse(false, 'Unknown rpc type');
    }
    return this.formatResponse(true);
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

  private formatResponse(valid = false, reason = ''): ValidationResponse {
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
    projectConfig.serviceEndpoints = project.serviceEndpoints;

    const validateResult = await this.validateProjectEndpoints(project, project.serviceEndpoints);
    if (!validateResult.valid) {
      throw new Error(`Invalid endpoints: ${validateResult.reason}`);
    }

    for (const endpoint of project.serviceEndpoints) {
      endpoint.isWebsocket = endpoint.key.endsWith('Ws');
      endpoint.rpcFamily = manifest.rpcFamily || [];
    }

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
    const rpcFamily = manifest.rpcFamily[0];
    const family = getRpcFamilyObject(rpcFamily);
    const keys = family?.getEndpointKeys();
    const endpoint = project.serviceEndpoints.find(
      (endpoint) => endpoint.value && keys?.includes(endpoint.key)
    );
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
