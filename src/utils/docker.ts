// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'fs';
import { join } from 'path';
import * as handlebars from 'handlebars';
import { getLogger } from 'src/utils/logger';

// move to types folder
export type TemplateType = {
  deploymentID: string;
  projectID: string;
  networkEndpoint: string;
  nodeVersion: string;
  queryVersion: string;
  servicePort: number;
  dictionary?: string;
};

export function projectId(cid: string): string {
  return cid.substring(0, 15).toLowerCase();
}

export function getServicePort(queryEndpoint: string): number | undefined {
  return queryEndpoint ? Number(queryEndpoint.split(':')[2]) : undefined;
}

export function nodeEndpoint(cid: string, port: number): string {
  return `http://node_${projectId(cid)}:${port}`;
}

export function queryEndpoint(cid: string, port: number): string {
  return `http://query_${projectId(cid)}:${port}`;
}

export function getComposeFilePath(name: string): string {
  return join('/var/tmp', 'composeFiles', name);
}

export function nodeContainer(cid: string): string {
  return `node_${projectId(cid)}`;
}

export function queryContainer(cid: string): string {
  return `query_${projectId(cid)}`;
}

export function dbName(cid: string): string {
  return `db_${projectId(cid)}`;
}

export function projectContainers(cid: string) {
  return [nodeContainer(cid), queryContainer(cid)];
}

export function generateDockerComposeFile(data: TemplateType) {
  try {
    const file = fs.readFileSync(join(__dirname, 'template.yml'), 'utf8');
    const template = handlebars.compile(file);
    fs.writeFileSync(getComposeFilePath(`${data.deploymentID}.yml`), template(data));
    getLogger('docker').info(`generate new docker compose file: ${data.deploymentID}.yml`);
  } catch (e) {
    getLogger('docker').error(
      `fail to generate new docker compose file for ${data.deploymentID}: ${e} `,
    );
  }
}
