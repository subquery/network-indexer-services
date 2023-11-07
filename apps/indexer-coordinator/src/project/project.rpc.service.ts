// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DesiredStatus } from 'src/core/types';
import { getDomain, getIpAddress, isIp, isPrivateIp } from 'src/utils/network';
import { Repository } from 'typeorm';
import { RpcManifest } from './project.manifest';
import { IProjectConfig, Project, ProjectEntity } from './project.model';
import { ProjectService } from './project.service';

interface IRpcFamily {
  getEndpointKeys(): string[];
}

class RpcFamilyEvm implements IRpcFamily {
  getEndpointKeys(): string[] {
    return ['evmWs', 'evmHttp'];
  }
}

class RpcFamilySubstrate implements IRpcFamily {
  getEndpointKeys(): string[] {
    return ['substrateWs', 'substrateHttp'];
  }
}

@Injectable()
export class ProjectRpcService {
  private rpcFamilyMap = new Map<string, IRpcFamily>();

  constructor(
    @InjectRepository(ProjectEntity) private projectRepo: Repository<ProjectEntity>,
    private projectService: ProjectService
  ) {}

  getRpcFamilyObject(rpcFamily: string): IRpcFamily | undefined {
    let family = this.rpcFamilyMap.get(rpcFamily);
    if (!family) {
      switch (rpcFamily) {
        case 'evm':
          family = new RpcFamilyEvm();
          break;
        case 'substrate':
          family = new RpcFamilySubstrate();
          break;
        default:
          return undefined;
      }
      this.rpcFamilyMap.set(rpcFamily, family);
    }
    return family;
  }

  getEndpointKeys(rpcFamily: string): string[] {
    const family = this.getRpcFamilyObject(rpcFamily);
    if (!family) return [];

    // TODO return family.getEndpointKeys();
    return family.getEndpointKeys().filter((key) => key.endsWith('Http'));
  }

  getAllEndpointKeys(rpcFamilyList: string[]): string[] {
    return rpcFamilyList.map((family) => this.getEndpointKeys(family)).flat();
  }

  async validateRpcEndpoint(id: string, endpoint: string): Promise<boolean> {
    // should be internal ip
    const domain = getDomain(endpoint);
    if (!domain) {
      return false;
    }
    let ip: string;
    if (isIp(domain)) {
      ip = domain;
    } else {
      ip = await getIpAddress(domain);
    }
    if (!ip) {
      return false;
    }
    if (!isPrivateIp(ip)) {
      return false;
    }

    // TODO could read info
    // TODO compare chain id, genesis hash, rpc family, client name and version, node type

    return true;
  }

  async startRpcProject(id: string, projectConfig: IProjectConfig): Promise<Project> {
    let project = await this.projectService.getProject(id);
    if (!project) {
      project = await this.projectService.addProject(id);
    }
    project.projectConfig = projectConfig;
    project.status = DesiredStatus.RUNNING;

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
}
