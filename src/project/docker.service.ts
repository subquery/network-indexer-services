// Copyright 2020-2021 OnFinality Limited authors & contributors
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'fs';
import { exec } from 'child_process';
import { Injectable } from '@nestjs/common';
import { getLogger } from 'src/utils/logger';
import { getInsideComposeFilePath } from 'src/utils/docker';

// TODO: 
// 1. don't output indexing project logs in `coordinator` console
// 2. support to get latest logs for specific indexing project

@Injectable()
export class DockerService {
  constructor() { }

  up(fileName: string): Promise<boolean> {
    const filePath = getInsideComposeFilePath(`${fileName}.yml`);
    if (fs.existsSync(filePath)) {
      getLogger('docker').info(`start new project ${fileName}`);
      return this.execute(`docker-compose -f ${filePath} up -d`);
    } else {
      getLogger('docker').error(`file: ${filePath} not exist`);
    }
  }

  stop(service: string): Promise<boolean> {
    return this.execute(`docker-compose stop ${service}`);
  }

  async createDB(name: string): Promise<boolean> {
    getLogger('docker').info(`create new db: ${name}`);
    // TODO: check db exist or not
    const dbDocker = 'dev_postgres_1'; // FIXME: 'indexer-coordinator_postgres_1'
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

  // TODO: support get latest log with container id or name

  execute(cmd: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      exec(cmd, (error, stdout, stderr) => {
        if (error) {
          getLogger('docker').error(error);
          reject(error);
        } else if (stdout) {
          getLogger('docker').info(stdout);
        } else {
          getLogger('docker').error(stderr);
          reject(error);
        }
        resolve(stdout ? true : false);
      });
    });
  }
}
