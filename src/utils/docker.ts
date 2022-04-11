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
  poiEnabled: boolean;
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

export function getComposeFileDirectory(cid: string): string {
  return join('/var/tmp', `composeFiles/${cid}`);
}

export function getComposeFilePath(cid: string): string {
  return join(getComposeFileDirectory(cid), 'docker-compose.yml');
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
  const directory = getComposeFileDirectory(data.deploymentID);
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }

  try {
    const file = fs.readFileSync(join(__dirname, 'template.yml'), 'utf8');
    const template = handlebars.compile(file);
    fs.writeFileSync(getComposeFilePath(data.deploymentID), template(data));
    getLogger('docker').info(`generate new docker compose file: ${data.deploymentID}.yml`);
  } catch (e) {
    getLogger('docker').error(
      `fail to generate new docker compose file for ${data.deploymentID}: ${e} `,
    );
  }
}

export function canContainersRestart(id: string, containersInfo: string): boolean {
  const containersExist =
    containersInfo.includes(nodeContainer(id)) && containersInfo.includes(queryContainer(id));
  const isContainerAborted =
    containersInfo.includes('Exited (134)') || containersInfo.includes('Exited (137)');

  return containersExist && !isContainerAborted;
}
