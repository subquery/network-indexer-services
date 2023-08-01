// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

export type FormValues = {
  [key: string]: string;
};

export type HookDependency = boolean | number | string;

export interface IProjectBaseConfig {
  networkEndpoints: string[] | undefined;
  networkDictionary: string | undefined;
  nodeVersion: string | undefined;
  queryVersion: string | undefined;
}

export interface IProjectAdvancedConfig {
  poiEnabled: boolean;
  purgeDB: boolean;
  timeout: number;
  workers: number;
  batchSize: number;
  cache: number;
  cpu: number;
  memory: number;
}
