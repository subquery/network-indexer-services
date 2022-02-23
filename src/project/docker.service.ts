// Copyright 2020-2021 OnFinality Limited authors & contributors
// SPDX-License-Identifier: Apache-2.0

import fs from 'fs';
import { exec } from 'child_process';
import { Injectable } from '@nestjs/common';
import { getLogger } from 'src/utils/logger';

@Injectable()
export class DockerService {
  constructor() {
    this.createNetwork();
  }

  up(fileName: string): Promise<boolean> {
    const filePath = `../../compose-files/${fileName}`;
    if (fs.existsSync(filePath)) {
      return this.execute(`docker-compose -f ${filePath} up -d`);
    } else {
      getLogger('docker').error(`file: ${filePath} not exist`);
    }
  }

  stop(service: string): Promise<boolean> {
    return this.execute(`docker-compose stop ${service}`);
  }

  createNetwork() {
    this.execute('docker network create cooridnator-service');
  }

  createDB(name: string): Promise<boolean | string> {
    // TODO: check db exist or not
    return this.execute(
      `docker exec -i indexer-coordinator_postgres_1 psql -U postgres -c "create database ${name}`,
    );
  }

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
