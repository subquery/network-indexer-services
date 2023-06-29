// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'fs';
import { join } from 'path';
import * as handlebars from 'handlebars';

import { TemplateType } from '../project/types';
import { getLogger } from './logger';
import { nodeConfigs } from './project';

export function bytesToMegabytes(bytes: number): number {
  return bytes / (1024 * 1024);
}

export function projectId(cid: string): string {
  return cid.substring(0, 15).toLowerCase();
}

export function getServicePort(queryEndpoint: string): number | undefined {
  const port = queryEndpoint ? queryEndpoint.split(':')[2] : undefined;
  return !isNaN(Number(port)) ? Number(port) : undefined;
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

export async function generateDockerComposeFile(data: TemplateType) {
  const { deploymentID } = data;
  createDirectory(getComposeFileDirectory(deploymentID));

  try {
    const config = await nodeConfigs(deploymentID);
    const file = fs.readFileSync(join(__dirname, 'template.yml'), 'utf8');
    const template = handlebars.compile(file);
    fs.writeFileSync(getComposeFilePath(deploymentID), template({ ...data, ...config }));
    getLogger('docker').info(`generate new docker compose file: ${deploymentID}.yml`);
  } catch (e) {
    getLogger('docker').error(e, `fail to generate new docker compose file for ${data.deploymentID}`);
  }
}

export function canContainersRestart(id: string, containersInfo: string): boolean {
  const containersExist =
    containersInfo.includes(nodeContainer(id)) && containersInfo.includes(queryContainer(id));
  const isContainerAborted =
    containersInfo.includes('Exited (134)') || containersInfo.includes('Exited (137)');

  return containersExist && !isContainerAborted;
}
