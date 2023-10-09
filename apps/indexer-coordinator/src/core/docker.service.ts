// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { exec } from 'child_process';
import * as fs from 'fs';
import { Injectable } from '@nestjs/common';
import { v2 as compose } from 'docker-compose';
import Dockerode from 'dockerode';
import {
  getComposeFileDirectory,
  getComposeFilePath,
  projectContainers,
  projectId,
} from '../utils/docker';
import { getLogger } from '../utils/logger';

@Injectable()
export class DockerService {
  private docker: Dockerode;
  private containerMap = new Map<string, Dockerode.Container>();

  constructor() {
    this.docker = new Dockerode({ socketPath: '/var/run/docker.sock' });
  }

  getContainer(name: string): Dockerode.Container {
    let container = this.containerMap.get(name);
    if (!container) {
      container = this.docker.getContainer(name);
      this.containerMap.set(name, container);
    }
    return container;
  }

  async up(fileName: string) {
    if (!this.validateFileName(fileName)) {
      return;
    }
    await this.upWithApi(fileName);
  }

  async upWithApi(fileName: string) {
    const workingDir = getComposeFileDirectory(fileName);
    const filePath = getComposeFilePath(fileName);
    if (fs.existsSync(filePath)) {
      getLogger('docker').info(`start new project ${fileName}`);
      await this.rm(projectContainers(fileName));
      const result = await compose.upAll({
        cwd: workingDir,
        config: 'docker-compose.yml',
        composeOptions: ['-p', projectId(fileName)],
        log: true,
      });
      getLogger('docker').info(`start new project completed: ${result}`);
    } else {
      getLogger('docker').warn(`file: ${filePath} not exist`);
    }
  }

  async start(containers: string[]): Promise<string> {
    if (!this.validateContainerNames(containers)) {
      return;
    }
    try {
      return await this.startWithApi(containers);
    } catch (e) {
      getLogger('docker').error(e, `failed to restart the containers`);
    }
  }

  async startWithApi(containers: string[]): Promise<string> {
    return (await Promise.all(containers.map((name) => this.getContainer(name).start()))).join(
      '\n'
    );
  }

  async restart(containers: string[]): Promise<string> {
    if (!this.validateContainerNames(containers)) {
      return;
    }
    try {
      return await this.restartWithApi(containers);
    } catch (e) {
      getLogger('docker').error(e, `failed to restart the containers`);
    }
  }

  async restartWithApi(containers: string[]): Promise<string> {
    return (await Promise.all(containers.map((name) => this.getContainer(name).restart()))).join(
      '\n'
    );
  }

  async stop(containers: string[]): Promise<string> {
    if (!this.validateContainerNames(containers)) {
      return;
    }
    try {
      return await this.stopWithApi(containers);
    } catch (e) {
      getLogger('docker').warn(e, `failed to stop the containers`);
    }
  }

  async stopWithApi(containers: string[]): Promise<string> {
    return (await Promise.all(containers.map((name) => this.getContainer(name).stop()))).join('\n');
  }

  async rm(containers: string[]) {
    if (!this.validateContainerNames(containers)) {
      return;
    }
    try {
      getLogger('docker').info(`remove the old containers`);
      const result = await this.rmWithApi(containers);
      getLogger('docker').info(result);
    } catch (_) {
      getLogger('docker').info(`no containers need to be removed`);
    }
  }

  async rmWithApi(containers: string[]) {
    return (await Promise.all(containers.map((name) => this.getContainer(name).remove()))).join(
      '\n'
    );
  }

  async ps(containers: string[]): Promise<any[]> {
    if (!this.validateContainerNames(containers)) {
      return;
    }
    try {
      return await this.psWithApi(containers);
    } catch (_) {
      return [];
    }
  }

  async psWithApi(containers: string[]): Promise<any[]> {
    const result = await Promise.all(
      containers.map(async (name) => {
        const container = await this.getContainer(name).inspect();
        delete container?.State?.Health?.Log;

        return { ...(container?.State ?? {}), Name: container?.Name?.replace('/', '') ?? '' };
      })
    );
    return result;
  }

  async imageVersion(container: string) {
    if (!this.validateContainerName(container)) {
      return '';
    }
    try {
      return await this.imageVersionWithApi(container);
    } catch {
      return '';
    }
  }

  async imageVersionWithApi(container: string) {
    const inspect = await this.getContainer(container).inspect();
    return inspect.Config.Image.split(':')[1] ?? '';
  }

  async logs(container: string): Promise<string> {
    if (!this.validateContainerName(container)) {
      return '';
    }
    try {
      return await this.logsWithApi(container);
    } catch (e) {
      getLogger('docker').error(e, `failed to get the logs of ${container}`);
      return '';
    }
  }

  async logsWithApi(container: string): Promise<string> {
    const buffer = await this.getContainer(container).logs({
      tail: 30,
      stdout: true,
      stderr: true,
    });
    return `\n${buffer.toString('utf8')}`.replace(/\n.{8}/gm, '\n').trim();
  }

  private execute(cmd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      exec(cmd, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else if (stderr) {
          reject(stderr);
        }
        resolve(stdout);
      });
    });
  }

  validateFilePath(path: string): boolean {
    const result = /^[(/|\\)a-zA-Z0-9_.-]+$/.test(path);
    if (!result) {
      getLogger('docker').error(`invalid file path: ${path}`);
    }
    return result;
  }

  validateFileName(name: string): boolean {
    const result = /^[a-zA-Z0-9_.-]+$/.test(name);
    if (!result) {
      getLogger('docker').error(`invalid file name: ${name}`);
    }
    return result;
  }

  validateContainerName(name: string): boolean {
    const result = /^[a-zA-Z0-9_.-]+$/.test(name);
    if (!result) {
      getLogger('docker').error(`invalid container name: ${name}`);
    }
    return result;
  }

  validateContainerNames(names: string[]): boolean {
    return names.every((name) => this.validateContainerName(name));
  }
}
