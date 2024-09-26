// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { gql } from '@apollo/client';

import { excellencyQuery } from './apolloClient';

// TODO: use the public queries from `network-clients`

const ProjectFields = `
  id
  status
  chainType
  projectType
  rateLimit
  hostType
  details {
    name
    owner
    image
    description
    projectDescription
    websiteUrl
    codeUrl
    version
    createdTimestamp
    updatedTimestamp
  }

  projectConfig {
    networkEndpoints
    networkDictionary
    nodeVersion
    queryVersion
    usePrimaryNetworkEndpoint
    poiEnabled
    purgeDB
    timeout
    worker
    batchSize
    cache
    cpu
    memory
    serviceEndpoints {
      key
      value
      valid
      reason
    }

  }
`;

const MetadataFields = `
  metadata {
    lastHeight
    lastTime
    targetHeight
    chain
    specName
    genesisHash
    healthy
    indexerNodeVersion
    queryNodeVersion
    indexerStatus
    queryStatus
    startHeight
  }
`;

const PaygFields = `
  payg {
    id
    threshold
    expiration
    price
    token
  }
`;

export type QueryResult = {
  loading?: boolean;
  data?: any;
  error?: Error;
};

/// Projects
export const START_PROJECT = gql`
  mutation StartProject(
    # $purgeDB: Boolean! = false
    $poiEnabled: Boolean!
    $queryVersion: String!
    $nodeVersion: String!
    $networkDictionary: String!
    $networkEndpoints: [String!]!
    $batchSize: Int!
    $workers: Int!
    $timeout: Int!
    $cache: Int!
    $cpu: Int!
    $memory: Int!
    $id: String!
    $projectType: Float!
    $serviceEndpoints: [SeviceEndpointInput!]!
    $rateLimit: Float!
    $hostType: String! = "system-managed"
  ) {
    startProject(
      id: $id
      rateLimit: $rateLimit
      projectConfig: {
        networkEndpoints: $networkEndpoints
        networkDictionary: $networkDictionary
        nodeVersion: $nodeVersion
        queryVersion: $queryVersion
        poiEnabled: $poiEnabled
        timeout: $timeout
        batchSize: $batchSize
        worker: $workers
        cache: $cache
        cpu: $cpu
        memory: $memory
        serviceEndpoints: $serviceEndpoints
      }
      projectType: $projectType
      hostType: $hostType
    ) {
      ${ProjectFields}
    }
  }
`;

export const STOP_PROJECT = gql`
  mutation StopProject($id: String!, $projectType: Float!) {
    stopProject(id: $id, projectType: $projectType) {
      ${ProjectFields}
    }
  }
`;

export const GET_PROJECT = gql`
  query Project($id: String!) {
    project(id: $id) {
      ${ProjectFields}
      ${MetadataFields}
      ${PaygFields}
    }
  }
`;

export const GET_PROJECT_NAME = gql`
  query Project($id: String!) {
    getProjectInfo(projectId: $id) {
      name
    }
  }
`;

export const GET_PROJECTS = gql`
  query {
    getProjects: getProjectsSimple {
      ${ProjectFields}
    }
  }
`;

export const ADD_PROJECT = gql`
  mutation AddProject($id: String!) {
    addProject(id: $id) {
      ${ProjectFields}
    }
  }
`;

export const REMOVE_PROJECT = gql`
  mutation RemoveProject($id: String!, $projectType: Float!) {
    removeProject(id: $id, projectType: $projectType) {
      status
    }
  }
`;

/// Accounts
export const GET_COORDINATOR_INDEXER = gql`
  query {
    accountMetadata {
      indexer
      network
    }
  }
`;

export const ADD_INDEXER = gql`
  mutation AddIndexer($indexer: String!) {
    addIndexer(address: $indexer) {
      address
    }
  }
`;

export const GET_CONTROLLERS = gql`
  query {
    controllers {
      id
      address
    }
  }
`;

export const ADD_CONTROLLER = gql`
  mutation AddController {
    addController
  }
`;

export const REMOVE_CONTROLLER = gql`
  mutation RemoveController($id: String!) {
    removeController(id: $id) {
      id
    }
  }
`;

export const WITHDRAW_CONTROLLER = gql`
  query WithdrawController($id: String!) {
    withdrawController(id: $id)
  }
`;

export const ANNOUNCE_READY = gql`
  mutation StartProjectOnChain($id: String!) {
    startProjectOnChain(id: $id)
  }
`;

export const ANNOUNCE_STOP = gql`
  mutation StopProjectOnChain($id: String!) {
    stopProjectOnChain(id: $id)
  }
`;

export const REMOVE_ACCOUNTS = gql`
  mutation {
    removeAccounts {
      indexer
      controller
      encryptedKey
      network
      networkEndpoint
    }
  }
`;

export const CHANNEL_CLOSE = gql`
  mutation ChannelClose($id: String!) {
    channelClose(id: $id) {
      id
      spent
      remote
      onchain
      lastFinal
    }
  }
`;

export const GET_LOG = gql`
  query GetLog($container: String!) {
    getLog(container: $container) {
      log
    }
  }
`;

export const GET_QUERY_METADATA = gql`
  query QueryMetadata($id: String!, $projectType: Float!) {
    serviceMetadata(id: $id, projectType: $projectType) {
      lastHeight
      startHeight
      targetHeight
      healthy
      lastTime
      specName
      chain
      indexerNodeVersion
      queryNodeVersion
      indexerStatus
      queryStatus
    }
  }
`;

// query project registry
export const GET_INDEXER_PROJECTS = gql`
  query GetIndexerProjects($indexer: String!) {
    indexerDeployments(filter: { indexerId: { equalTo: $indexer } }) {
      nodes {
        indexerId
        deploymentId
        status
      }
    }
  }
`;

export const GET_PROJECT_DETAILS = gql`
  query GetProjectDetails($deploymentId: String!) {
    deployments(filter: { id: { equalTo: $deploymentId } }) {
      nodes {
        id
        projectId
        project {
          owner
          currentVersion
          currentDeployment
          createdTimestamp
          updatedTimestamp
          metadata
        }
      }
    }
  }
`;

// query docker image versions
export const GET_REGISTRY_VERSIONS = gql`
  query GetRegistryVersions($range: String!, $registry: String!) {
    getRegistryVersions(range: $range, registry: $registry)
  }
`;

// PAYG
export const PAYG_PRICE = gql`
  mutation updateProjectPayg(
    $paygPrice: String!
    $paygToken: String!
    $paygExpiration: Float!
    $paygThreshold: Float!
    $paygOverflow: Float!
    $id: String!
  ) {
    updateProjectPayg(
      paygConfig: {
        price: $paygPrice
        token: $paygToken
        expiration: $paygExpiration
        threshold: $paygThreshold
        overflow: $paygOverflow
      }
      id: $id
    ) {
      id
    }
  }
`;

export const GET_ALL_ALIVEPAYG = gql`
  query payg {
    getAlivePaygs {
      id
      expiration
      price
      overflow
      threshold
      token
    }
  }
`;

// TODO: don't need this anymore
export const CHANNEL_CHECKPOINT = gql`
  mutation ChannelCheckpoint($id: String!) {
    channelCheckpoint(id: $id) {
      id
      spent
      remote
      onchain
    }
  }
`;

export const GET_RPC_ENDPOINT_KEYS = gql`
  query getRpcEndpointKeys($projectId: String!) {
    getRpcEndpointKeys(projectId: $projectId)
  }
`;

export const VALID_RPC_ENDPOINT = gql`
  query validateRpcEndpoint($projectId: String!, $endpointKey: String!, $endpoint: String!) {
    validateRpcEndpoint(projectId: $projectId, endpointKey: $endpointKey, endpoint: $endpoint) {
      valid
      reason
      level
    }
  }
`;

export const GET_SUBGRAPH_ENDPOINTS = gql`
  query getSubgraphEndpoints($cid: String!, $host: String!, $ports: [SubgraphPort!]!) {
    getSubgraphEndpoints(cid: $cid, host: $host, ports: $ports) {
      key
      value
    }
  }
`;

export interface ManiFest {
  getManifest: {
    rpcManifest?: {
      chain: { chainId: string };
      nodeType: string;
      name: string;
      rpcFamily: string[];
      client?: { name: string; version: string };
    };
    subqueryManifest?: {
      dataSources?: { kind: string }[];
      schema?: { file: string };
      network?: { chainId: string };
      specVersion: string;
      runner?: {
        node: {
          name?: string;
          version?: string;
        };
        query: {
          name?: string;
          version?: string;
        };
      };
    };
    subgraphManifest?: {
      specVersion?: string;
      name?: string;
      chain?: { chainId: string };
      version?: string;
      rpcFamily?: string[];
      nodeType?: string;
      client?: { name: string; version: string };
      featureFlags?: string[];
      rpcAllowList?: string[];
      rpcDenyList?: string[];
      computeUnit?: { name: string; value: string }[];
    };
  };
}

export const GET_MANIFEST = gql`
  query getManifest($projectId: String!) {
    getManifest(projectId: $projectId) {
      rpcManifest {
        chain {
          chainId
        }
        name
        rpcFamily
        client {
          name
          version
        }
        nodeType
      }

      subqueryManifest {
        dataSources {
          kind
        }
        schema {
          file
        }
        network {
          chainId
        }
        specVersion
        runner {
          node {
            name
            version
          }
          query {
            name
            version
          }
        }
      }
      subgraphManifest {
        specVersion
        name
        chain {
          chainId
        }
        version
        rpcFamily
        nodeType
        client {
          name
          version
        }
        featureFlags
        rpcAllowList
        rpcDenyList
        computeUnit {
          name
          value
        }
      }
    }
  }
`;

export const GET_PROJECTS_METADATA = gql`
  query {
    getProjectsMetadata {
      id
      metadata {
        lastHeight
        startHeight
        targetHeight
      }
    }
  }
`;

export interface GetProjectRewardsDetails {
  queryProjectDetailsFromNetwork: {
    totalReward: string;
    indexerCount: number;
    totalAgreement: number;
    totalOffer: number;
  };
}

export const GET_PROJECT_REWARDS_DETAILS = gql`
  query getProjectRewardsDetails($id: String!) {
    queryProjectDetailsFromNetwork(id: $id) {
      totalReward
      indexerCount
      totalAgreement
      totalOffer
    }
  }
`;

export enum ConfigKey {
  FlexPrice = 'flex_price',
  FlexValidPeriod = 'flex_valid_period',
  FlexEnabled = 'flex_enabled',
  AllocationRewardThreshold = 'allocation_reward_threshold',
  StateChannelRewardThreshold = 'state_channel_reward_threshold',
  AutoReduceAllocationEnabled = 'auto_reduce_allocation_enabled',
}

export interface AllConfig {
  allConfig: {
    key: ConfigKey;
    value: string;
  }[];
}

export const SET_CONFIG = gql`
  mutation ($key: String!, $value: String!) {
    setConfig(key: $key, value: $value)
  }
`;

export const GET_ALL_CONFIG = gql`
  query {
    allConfig {
      key
      value
    }
  }
`;

// excellency gql

export interface IGetIndexerStatus {
  getIndexerServiceStatus: {
    endpointSuccess: boolean;
  } | null;
}

export const getIndexerStatus = (params: { deploymentId: string; indexer: string }) => {
  return excellencyQuery<IGetIndexerStatus>(`
    {
      getIndexerServiceStatus(deploymentId: "${params.deploymentId}", indexer: "${params.indexer}"){
        endpointSuccess
      }
    }
  `);
};

export interface IGetRequestHistory {
  getIndexerServiceRequestHistory: {
    healthyRate: number;
    latestSuccess: boolean;
    latestErrorMsg: string;
    total: number;
    success: number;
    failure: number;
    day: string;
  }[];
}

export const getRequestHistory = (params: { deploymentId: string; indexer: string }) => {
  return excellencyQuery<IGetRequestHistory>(`
    {
      getIndexerServiceRequestHistory(deploymentId: "${params.deploymentId}", indexer: "${params.indexer}") {
        healthyRate
        latestSuccess
        latestErrorMsg
        total
        success
        failure
        day
      }
    }
  `);
};
