// Copyright 2020-2021 OnFinality Limited authors & contributors
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'fs';
import { exec } from 'child_process';
import { Injectable } from '@nestjs/common';
import { getLogger } from 'src/utils/logger';
import { getComposeFilePath, projectContainers, projectId } from 'src/utils/docker';

@Injectable()
export class DockerService {
  constructor() { }

  async up(fileName: string): Promise<boolean> {
    const filePath = getComposeFilePath(`${fileName}.yml`);
    if (fs.existsSync(filePath)) {
      getLogger('docker').info(`start new project ${fileName}`);
      try {
        await this.rm(projectContainers(fileName));
        getLogger('docker').info(`remove the old containers`);
      } catch (_) {
        getLogger('docker').info(`no containers need to be removed`);
      }

      return this.execute(`docker-compose -f ${filePath} -p ${projectId(fileName)} up -d`);
    } else {
      getLogger('docker').error(`file: ${filePath} not exist`);
      return false;
    }
  }

  start(containers: string[]): Promise<boolean> {
    return this.execute(`docker start ${containers.join(' ')}`);
  }

  stop(containers: string[]): Promise<boolean> {
    return this.execute(`docker stop ${containers.join(' ')}`);
  }

  rm(containers: string[]): Promise<boolean> {
    return this.execute(`docker container rm ${containers.join(' ')}`);
  }

  // TODO: support logs for node | query services
  logs(container: string): Promise<boolean> {
    // TODO: the format of the text?
    return this.execute(`docker logs -l ${container}`);
  }

  async createDB(name: string): Promise<boolean> {
    getLogger('docker').info(`create new db: ${name}`);
    const dbDocker = process.env.DB_DOCKER ?? 'coordinator_db';
    try {
      await this.execute(
        `docker exec -i ${dbDocker} psql -U postgres -c "create database ${name}"`,
      );
      return true;
    } catch (e) {
      if (e.message.includes('already exists')) {
        return true;
      }
    }
  }

  execute(cmd: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      exec(cmd, (error, stdout, stderr) => {
        if (error) {
          // TODO: output this only with verbose [process.env.VERBOSE]
          // getLogger('docker').error(error);
          reject(error);
        } else if (stdout) {
          getLogger('docker').info(stdout);
        } else {
          reject(stderr);
        }
        resolve(stdout ? true : false);
      });
    });
  }
}
