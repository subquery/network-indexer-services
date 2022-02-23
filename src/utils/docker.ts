// Copyright 2020-2021 OnFinality Limited authors & contributors
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'fs';
import * as handlebars from 'handlebars';
import { join } from 'path';
import { getLogger } from 'src/utils/logger';

export type TemplateType = {
  deploymentID: string;
  networkEndpoint: string;
  dictionary: string;
  nodeServiceName: string;
  nodeVersion: string;
  database: string;
  servicePort: number;
  queryName: string;
  queryVersion: string;
};

export function getInsideComposeFilePath(name: string) {
  const root = __dirname.substring(0, __dirname.lastIndexOf('/'));
  return join(root, 'compose-files', name);
}

export function getOutsideComposeFilePath(name: string) {
  // TODO: this path can be an optional param
  const path = '/var/tmp/app';
  return join(path, 'compose-files', name);
}

// TODO: handle project with same `deploymentID`
export function generateDockerComposeFile(data: TemplateType) {
  try {
    const file = fs.readFileSync(join(__dirname, 'template.yml'), 'utf8');
    const template = handlebars.compile(file);
    fs.writeFileSync(getInsideComposeFilePath(`${data.deploymentID}.yml`), template(data));
    getLogger('docker').info(`generate new docker compose file: ${data.deploymentID}.yml`);
  } catch (e) {
    getLogger('docker').error(
      `fail to generate new docker compose file for ${data.deploymentID}: ${e}`,
    );
  }
}
