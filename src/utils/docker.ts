// Copyright 2020-2021 OnFinality Limited authors & contributors
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'fs';
import * as handlebars from 'handlebars';
import { join } from 'path';
import { getLogger } from 'src/utils/logger';

export type TemplateType = {
  deploymentID: string;
  projectID: string;
  networkEndpoint: string;
  nodeVersion: string;
  queryVersion: string;
  servicePort: number;
  dictionary?: string;
};

export function projectId(cid: string) {
  return cid.substring(0, 15).toLowerCase();
}

export function nodeEndpoint(cid: string, port: number) {
  return `http://node-${projectId(cid)}:${port}`;
}

export function queryEndpoint(cid: string, port: number) {
  return `http://query-${projectId(cid)}:${port}`;
}

export function getInsideComposeFilePath(name: string) {
  return join('/var/tmp', 'composeFiles', name);
}

export function nodeContainer(cid: string) {
  return `node_${projectId(cid)}`;
}

export function queryContainer(cid: string) {
  return `query_${projectId(cid)}`;
}

export function projectContainers(cid: string) {
  return [nodeContainer(cid), queryContainer(cid)];
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
