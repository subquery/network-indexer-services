// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { AsyncData } from '@subql/react-hooks';
import { FormikHelpers, FormikValues } from 'formik';

import { ControllerAction } from 'pages/controllers/types';

export type ChainType =
  | 'near'
  | 'flare'
  | 'cosmos'
  | 'algorand'
  | 'substrate'
  | 'ethereum'
  | 'stellar';

export enum DockerRegistry {
  query = 'onfinality/subql-query',
}

export enum ServiceStatus {
  TERMINATED,
  READY,
}

export enum ProjectStatus {
  NotIndexing = 'NOT INDEXING',
  Started = 'STARTED',
  Indexing = 'INDEXING',
  Ready = 'READY',
  Terminated = 'TERMINATED',
  Unhealthy = 'UNHEALTHY',
  Starting = 'STARTING',
  Unknown = 'UNKNOWN',
}

export enum PaygStatus {
  Open = 'OPEN',
  Close = 'CLOSE',
}

export type TransactionType =
  | ProjectAction.AnnounceIndexing
  | ProjectAction.AnnounceReady
  | ProjectAction.AnnounceNotIndexing;

export enum AccountAction {
  unregister = 'unregister',
  updateMetaData = 'updateMetadata',
}

export enum ProjectsAction {
  addProject = 'addProject',
}

export enum ProjectAction {
  StartIndexing = 'StartIndexing',
  AnnounceIndexing = 'AnnounceIndexing',
  RestartProject = 'RestartProject',
  AnnounceReady = 'AnnounceReady',
  StopProject = 'StopProject',
  AnnounceNotIndexing = 'AnnounceNotIndexing',
  StopIndexing = 'StopIndexing',
  RemoveProject = 'Remove Project',
}

export enum PAYGAction {
  PaygOpen = 'Open PAYG',
  PaygChangePrice = 'Change Price',
  PaygClose = 'Close PAYG',
}

// TODO: move these types to global types
export type ModalAction =
  | AccountAction
  | ControllerAction
  | ProjectsAction
  | ProjectAction
  | PAYGAction;
export type ClickAction = (type?: ModalAction) => void;
export type FormSubmit = (values: FormikValues, helper: FormikHelpers<FormikValues>) => void;

export interface AsyncMemoReturn<T> extends AsyncData<T> {
  refetch: (retainCurrent?: boolean) => void;
}

export type ProjectConfig = {
  baseConfig: {
    networkEndpoints: string[];
    networkDictionary: string;
    nodeVersion: string;
    queryVersion: string;
  };
  advancedConfig: {
    poiEnabled: boolean;
    purgeDB: boolean;
    timeout: number;
    worker: number;
    batchSize: number;
    cache: number;
    cpu: number;
    memory: number;
  };
  payg: {
    id: string;
    threshold: number;
    expiration: number;
    price: string;
    token: string;
  };
};

export type ProjectServiceMetadata = {
  id: string;
  status: ServiceStatus;
} & ProjectConfig;

export enum dockerContainerEnum {
  TERMINATED = 'TERMINATED',
  HEALTHY = 'HEALTHY',
  UNHEALTHY = 'UNHEALTHY',
  STARTING = 'STARTING',
}

// TODO: investigate all status
// i am not very sure what exact status of it.
export type dockerContainerStatus =
  | dockerContainerEnum.TERMINATED
  | dockerContainerEnum.HEALTHY
  | dockerContainerEnum.UNHEALTHY
  | dockerContainerEnum.STARTING;

export type TQueryMetadata = {
  lastProcessedHeight: number;
  lastProcessedTimestamp: number;
  targetHeight: number;
  chain: string;
  specName: string;
  genesisHash: string;
  indexerHealthy?: boolean;
  indexerNodeVersion: string;
  queryNodeVersion: string;
  indexerStatus: dockerContainerStatus;
  queryStatus: dockerContainerStatus;
  startHeight?: number;
};

export type ProjectDetails = {
  nodeEndpoint: string;
  queryEndpoint: string;
  chainType: string;
  details: {
    name: string;
    owner: string;
    image: string;
    description: string;
    websiteUrl: string;
    codeUrl: string;
    version: string;
    createdTimestamp: string;
    updatedTimestamp: string;
  };
  metadata: TQueryMetadata;
} & ProjectServiceMetadata;

// manifest types
export type Runner = {
  node?: {
    name: string;
    version: string;
  };
  query?: {
    name: string;
    version: string;
  };
};

type DataSources = {
  kind: string;
};

export type PartialIpfsDeploymentManifest = {
  dataSources: DataSources[];
  schema: {
    file: string;
  };
  network: {
    chainId?: string;
  };
  specVersion: string;
  runner?: Runner;
};
