// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'fs';
import { join } from 'path';
import * as handlebars from 'handlebars';
import { getLogger } from 'src/utils/logger';
import { Postgres } from 'src/configure/configure.module';
import { nodeConfigs } from './project';

// move to types folder
export type TemplateType = {
  deploymentID: string;
  projectID: string;
  networkEndpoint: string;
  nodeVersion: string;
  queryVersion: string;
  servicePort: number;
  poiEnabled: boolean;
  networkDictionary?: string;
  dbSchema: string;
  postgres: Postgres;
  mmrPath: string;
  worker: number;
  batchSize: number;
  timeout: number;
  cache: number;
  cpu: number;
  memory: number;
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
  return join('/usr', `projects/${cid}`);
}

export function getMmrPathDirectory(path: string, cid: string): string {
  return join(path, `poi/${cid}`);
}

export function getMmrFile(path: string, cid: string): string {
  return join(getMmrPathDirectory(path, cid), '.mmr');
}

export function getComposeFilePath(cid: string): string {
  return join(getComposeFileDirectory(cid), 'docker-compose.yml');
}

export function composeFileExist(cid: string): boolean {
  return fs.existsSync(getComposeFilePath(cid));
}

export function nodeContainer(cid: string): string {
  return `node_${projectId(cid)}`;
}

export function queryContainer(cid: string): string {
  return `query_${projectId(cid)}`;
}

export function schemaName(cid: string): string {
  return `schema_${projectId(cid)}`;
}

export function projectContainers(cid: string) {
  return [nodeContainer(cid), queryContainer(cid)];
}

function createDirectory(path: string) {
  if (!fs.existsSync(path)) {
    fs.mkdirSync(path, { recursive: true });
  }
}

export function getImageVersion(containerInfo: string) {
  const info = containerInfo.split(/\b\s+/);
  if (info.length < 2) return '';

  const imageInfo = info[1].split(':');
  if (imageInfo.length < 2) return '';

  return imageInfo[1];
}

export function getPoiEnable(chainType: string, poiEnabled: boolean): boolean {
  return chainType === 'substrate' ? poiEnabled : false;
}

export async function configsWithNode({ id, poiEnabled }: { id: string; poiEnabled: boolean }) {
  const { chainType, dockerRegistry } = await nodeConfigs(id);
  const disableHistorical = chainType === 'avalanche';
  return {
    poiEnabled: getPoiEnable(chainType, poiEnabled),
    chainType,
    disableHistorical,
    dockerRegistry,
  };
}

export async function generateDockerComposeFile(data: TemplateType) {
  createDirectory(getComposeFileDirectory(data.deploymentID));
  createDirectory(getMmrPathDirectory(data.mmrPath, data.deploymentID));

  try {
    const config = await configsWithNode({ id: data.deploymentID, poiEnabled: data.poiEnabled });
    const file = fs.readFileSync(join(__dirname, 'template.yml'), 'utf8');
    const template = handlebars.compile(file);
    fs.writeFileSync(getComposeFilePath(data.deploymentID), template({ ...data, ...config }));
    getLogger('docker').info(`generate new docker compose file: ${data.deploymentID}.yml`);
  } catch (e) {
    getLogger('docker').error(`fail to generate new docker compose file for ${data.deploymentID}: ${e} `);
  }
}

export function canContainersRestart(id: string, containersInfo: string): boolean {
  const containersExist =
    containersInfo.includes(nodeContainer(id)) && containersInfo.includes(queryContainer(id));
  const isContainerAborted =
    containersInfo.includes('Exited (134)') || containersInfo.includes('Exited (137)');

  return containersExist && !isContainerAborted;
}
