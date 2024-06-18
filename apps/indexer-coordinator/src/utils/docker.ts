// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'fs';
import { join } from 'path';
import * as handlebars from 'handlebars';
import { z } from 'zod';

import { TemplateType } from '../project/types';
import { argv } from '../yargs';
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

export function adminEndpoint(cid: string, port: number): string {
  return `http://node_${projectId(cid)}:${port}/admin`;
}

export function getComposeFileDirectory(cid: string): string {
  return join(argv['compose-file-directory'], `projects/${cid}`);
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

  handlebars.registerHelper('eq', (a, b) => a === b);
  handlebars.registerHelper('ge', (a, b) => a >= b);

  try {
    const config = await nodeConfigs(deploymentID);
    const context = { ...data, ...config };
    getTemplateContextValidator().parse(context);

    const file = fs.readFileSync(join(__dirname, 'template.yml'), 'utf8');
    const template = handlebars.compile(file, { noEscape: true })(context);

    fs.writeFileSync(getComposeFilePath(deploymentID), template);
    getLogger('docker').info(`generate new docker compose file: ${deploymentID}.yml`);
  } catch (e) {
    const message = `Failed to generate new docker compose file for ${data.deploymentID}`;
    getLogger('docker').error(e, message);
    throw new Error(message);
  }
}

export function canContainersRestart(id: string, containerStates: any[]): boolean {
  const containerNames = containerStates.map((container) => container.Name);
  const containersExist =
    containerNames.includes(nodeContainer(id)) && containerNames.includes(queryContainer(id));
  const exitCodes = containerStates.map((container) => container.ExitCode);
  const isContainerAborted = exitCodes.includes(137) || exitCodes.includes(143);

  return containersExist && !isContainerAborted;
}

function getTemplateContextValidator() {
  const versionSchema = z.string().refine((v) => v.match(/^v?\d+\.\d+\.\d+(-\d+)?$/), {
    message: 'Invalid version string',
  });
  const emptyString = z.string().refine((v) => !v, { message: 'Invalid empty string' });
  return z.object({
    networkEndpoints: z.array(z.string().url()),
    networkDictionary: z.string().url().or(emptyString),
    nodeVersion: versionSchema,
    queryVersion: versionSchema,
  });
}
