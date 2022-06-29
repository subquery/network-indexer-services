// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import * as fs from 'fs';
import { join } from 'path';
import * as handlebars from 'handlebars';
import { getLogger } from 'src/utils/logger';
import { Postgres } from 'src/configure/configure.module';

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
  dbSchema: string;
  postgres: Postgres;
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

export function getMmrFile(cid: string): string {
  return join('/var/tmp', `composeFiles/${cid}/.mmr`);
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

export function getImageVersion(containerInfo: string) {
  const info = containerInfo.split(/\b\s+/);
  if (info.length < 2) return '';

  const imageInfo = info[1].split(':');
  if (imageInfo.length < 2) return '';

  return imageInfo[1];
}

enum NodeTypes {
  substrate = 'node',
  avalanche = 'node-avalanche',
  cosmos = 'node-cosmos',
}

enum ChainTypes {
  polkadot = 'polkadot',
  kusama = 'kusama',
  avalanche = 'avalanche',
  juno = 'juno',
}

// TODO: use manifest -> datasource -> runtime to indentify chain type
function getNodeType(endpoint: string): NodeTypes {
  if (endpoint.includes(ChainTypes.avalanche)) {
    return NodeTypes.avalanche;
  } else if (endpoint.includes(ChainTypes.juno)) {
    return NodeTypes.cosmos;
  }
  return NodeTypes.substrate;
}

function configsWithNode(data: TemplateType) {
  const nodeType = getNodeType(data.networkEndpoint).toString();
  const poiEnabled = nodeType === NodeTypes.substrate ? data.poiEnabled : false;
  const disableHistorical = nodeType === NodeTypes.avalanche;

  return { nodeType, poiEnabled, disableHistorical };
}

export function generateDockerComposeFile(data: TemplateType) {
  const directory = getComposeFileDirectory(data.deploymentID);
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }

  try {
    const config = configsWithNode(data);
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
