// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import {exec} from 'child_process';
import * as fs from 'fs';
import {Injectable} from '@nestjs/common';

import {getComposeFilePath, getImageVersion, projectContainers, projectId} from '../utils/docker';
import {getLogger} from '../utils/logger';

@Injectable()
export class DockerService {
  async up(fileName: string) {
    const filePath = getComposeFilePath(fileName);
    if (fs.existsSync(filePath)) {
      getLogger('docker').info(`start new project ${fileName}`);
      await this.rm(projectContainers(fileName));
      const result = await this.execute(`docker-compose -f ${filePath} -p ${projectId(fileName)} up -d`);
      getLogger('docker').info(`start new project completed: ${result}`);
    } else {
      getLogger('docker').warn(`file: ${filePath} not exist`);
    }
  }

  async start(containers: string[]): Promise<string> {
    try {
      return this.execute(`docker start ${containers.join(' ')}`);
    } catch (e) {
      getLogger('docker').error(e,`failed to restart the containers`);
    }
  }

  async stop(containers: string[]): Promise<string> {
    try {
      return await this.execute(`docker stop ${containers.join(' ')}`);
    } catch (e) {
      getLogger('docker').warn(e,`failed to stop the containers`);
    }
  }

  async rm(containers: string[]) {
    try {
      getLogger('docker').info(`remove the old containers`);
      const result = await this.execute(`docker container rm ${containers.join(' ')}`);
      getLogger('docker').info(result);
    } catch (_) {
      getLogger('docker').info(`no containers need to be removed`);
    }
  }

  async ps(containers: string[]): Promise<string> {
    try {
      const result = await this.execute(`docker container ps -a | grep -E '${containers.join('|')}'`);
      return result;
    } catch (_) {
      return '';
    }
  }

  async imageVersion(container: string) {
    try {
      const info = await this.ps([container]);
      return getImageVersion(info);
    } catch {
      return '';
    }
  }

  async logs(container: string): Promise<string> {
    return this.execute(`docker logs -n 30 ${container}`);
  }

  async deleteFile(path: string) {
    try {
      await this.execute(`rm -rf ${path}`);
      getLogger('docker').info(`delete: ${path}`);
    } catch {
      getLogger('docker').info(`failed to delete: ${path}`);
    }
  }

  execute(cmd: string): Promise<string> {
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
}
