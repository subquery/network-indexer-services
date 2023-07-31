// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import * as yup from 'yup';

import { IndexerMetadata } from 'pages/account/types';
import { TOKEN_SYMBOL } from 'utils/web3';

import { IProjectAdvancedConfig } from './types';

export const defaultAdvancedConfig: IProjectAdvancedConfig = {
  purgeDB: false,
  poiEnabled: true,
  timeout: 1800,
  workers: 2,
  batchSize: 50,
  cache: 300,
  cpu: 2,
  memory: 2046,
};

// indexer register
export enum RegisterFormKey {
  name = 'name',
  proxyEndpoint = 'proxyEndpoint',
  amount = 'amount',
  rate = 'rate',
}

export const RegisterFormSchema = yup.object({
  [RegisterFormKey.name]: yup.string().defined(),
  [RegisterFormKey.proxyEndpoint]: yup.string().defined(),
  [RegisterFormKey.amount]: yup
    .number()
    .min(14000, `Staking token should large than 14,000 ${TOKEN_SYMBOL}`)
    .defined(),
  [RegisterFormKey.rate]: yup
    .number()
    .min(0, 'Rate should be between 0 and 100')
    .max(100, 'Rate should be between 0 and 100')
    .defined(),
});

export const initialRegisterValues = {
  [RegisterFormKey.name]: '',
  [RegisterFormKey.proxyEndpoint]: '',
  [RegisterFormKey.amount]: 0,
  [RegisterFormKey.rate]: 0,
};

export type TRegisterValues = yup.Asserts<typeof RegisterFormSchema>;

// update metadata
export enum MetadataFormKey {
  name = 'name',
  proxyEndpoint = 'proxyEndpoint',
}

export const MetadataFormSchema = yup.object({
  [RegisterFormKey.name]: yup.string().defined(),
  [RegisterFormKey.proxyEndpoint]: yup.string().defined(),
});

export const initialMetadataValues = (metadata?: IndexerMetadata) => ({
  [RegisterFormKey.name]: metadata?.name,
  [RegisterFormKey.proxyEndpoint]: metadata?.url,
});

export type TMetadataValues = yup.Asserts<typeof MetadataFormSchema>;

// config controllerItem
export enum ControllerFormKey {
  privateKey = 'privateKey',
}

export const ControllerFormSchema = yup.object({
  [ControllerFormKey.privateKey]: yup.string().defined(),
});

export const initialControllerValues = {
  [ControllerFormKey.privateKey]: '',
};

// add project
export enum ProjectFormKey {
  deploymentId = 'deploymentId',
  networkEndpoints = 'networkEndpoints',
  indexDictionary = 'indexDictionary',
  networkDictionary = 'networkDictionary',
  nodeVersion = 'nodeVersion',
  queryVersion = 'queryVersion',
  purgeDB = 'purgeDB',
  batchSize = 'batchSize',
  worker = 'worker',
  cache = 'cache',
  cpu = 'cpu',
  memory = 'memory',
  // FIXME: remove
  paygPrice = 'paygPrice',
  paygExpiration = 'paygExpiration',
  paygThreshold = 'paygThreshold',
  paygOverflow = 'paygOverflow',
}

export const CIDv0 = new RegExp(/^Qm[1-9A-HJ-NP-Za-km-z]{44}/i);
export const ProjectFormSchema = yup.object({
  [ProjectFormKey.deploymentId]: yup
    .string()
    .matches(CIDv0, `Invalid deployment id format`)
    .defined(),
});

export const initialProjectValues = {
  [ProjectFormKey.deploymentId]: '',
};

export const StartIndexingSchema = yup.object({
  [ProjectFormKey.networkEndpoints]: yup
    .string()
    .required('Network endpoints is required')
    .min(1, 'Network endpoints cannot be empty'),
  [ProjectFormKey.networkDictionary]: yup.string().optional(),
  [ProjectFormKey.nodeVersion]: yup
    .string()
    .required('Node version is required')
    .min(1, 'Node version cannot be empty'),
  [ProjectFormKey.queryVersion]: yup
    .string()
    .required('Query version is required')
    .min(1, 'Query version cannot be empty'),
});

export type IndexingEndpoint = yup.Asserts<typeof StartIndexingSchema>;

// PAYG
export enum OpenPAYGFormKey {
  paygPrice = 'paygPrice',
  paygPeriod = 'paygPeriod',
}

export interface PaygEdit {
  paygPrice: string;
  paygExpiration: number;
}

export const initalPAYGValues = (config: PaygEdit) => ({
  [OpenPAYGFormKey.paygPrice]: config.paygPrice || '',
  [OpenPAYGFormKey.paygPeriod]: config.paygExpiration || '',
});

export const ProjectPaygSchema = yup.object({
  [OpenPAYGFormKey.paygPrice]: yup.string().defined(),
  [OpenPAYGFormKey.paygPeriod]: yup.number().defined(),
});
