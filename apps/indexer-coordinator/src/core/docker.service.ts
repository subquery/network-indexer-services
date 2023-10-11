// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { exec } from 'child_process';
import * as fs from 'fs';
import { Injectable } from '@nestjs/common';
import Dockerode from 'dockerode';
import { getComposeFilePath, projectContainers, projectId } from '../utils/docker';
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
    const filePath = getComposeFilePath(fileName);
    if (fs.existsSync(filePath)) {
      getLogger('docker').info(`start new project ${fileName}`);
      await this.rm(projectContainers(fileName));
      const result = await this.execute(
        `docker-compose -f ${filePath} -p ${projectId(fileName)} up -d`
      );
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
      return (await Promise.all(containers.map((name) => this.getContainer(name).start()))).join(
        '\n'
      );
    } catch (e) {
      getLogger('docker').error(e, `failed to restart the containers`);
    }
  }

  async restart(containers: string[]): Promise<string> {
    if (!this.validateContainerNames(containers)) {
      return;
    }
    try {
      return (await Promise.all(containers.map((name) => this.getContainer(name).restart()))).join(
        '\n'
      );
    } catch (e) {
      getLogger('docker').error(e, `failed to restart the containers`);
    }
  }

  async stop(containers: string[]): Promise<string> {
    if (!this.validateContainerNames(containers)) {
      return;
    }
    try {
      return (await Promise.all(containers.map((name) => this.getContainer(name).stop()))).join(
        '\n'
      );
    } catch (e) {
      getLogger('docker').warn(e, `failed to stop the containers`);
    }
  }

  async rm(containers: string[]) {
    if (!this.validateContainerNames(containers)) {
      return;
    }
    try {
      getLogger('docker').info(`remove the old containers`);
      const result = (
        await Promise.all(containers.map((name) => this.getContainer(name).remove()))
      ).join('\n');
      getLogger('docker').info(result);
    } catch (_) {
      getLogger('docker').info(`no containers need to be removed`);
    }
  }

  async ps(containers: string[]): Promise<any[]> {
    if (!this.validateContainerNames(containers)) {
      return;
    }
    try {
      return await Promise.all(
        containers.map(async (name) => {
          const container = await this.getContainer(name).inspect();
          delete container?.State?.Health?.Log;
          return { ...(container?.State ?? {}), Name: container?.Name?.replace('/', '') ?? '' };
        })
      );
    } catch (_) {
      return [];
    }
  }

  async imageVersion(container: string) {
    if (!this.validateContainerName(container)) {
      return '';
    }
    try {
      const inspect = await this.getContainer(container).inspect();
      return inspect.Config.Image.split(':')[1] ?? '';
    } catch {
      return '';
    }
  }

  async logs(container: string): Promise<string> {
    if (!this.validateContainerName(container)) {
      return '';
    }
    try {
      const buffer = await this.getContainer(container).logs({
        tail: 30,
        stdout: true,
        stderr: true,
      });
      return `\n${buffer.toString('utf8')}`.replace(/\n.{8}/gm, '\n').trim();
    } catch (e) {
      getLogger('docker').error(e, `failed to get the logs of ${container}`);
      return '';
    }
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
