// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useMemo, useState } from 'react';
import { NetworkStatus, useLazyQuery, useQuery } from '@apollo/client';
import { useInterval } from 'ahooks';
import axios from 'axios';
import yaml from 'js-yaml';
import { isEmpty } from 'lodash';

import { useContractSDK } from 'containers/contractSdk';
import { useCoordinatorIndexer } from 'containers/coordinatorIndexer';
import {
  ChainType,
  dockerContainerEnum,
  DockerRegistry,
  PartialIpfsDeploymentManifest,
  ProjectDetails,
  ServiceStatus,
  TQueryMetadata,
} from 'pages/project-details/types';
import { coordinatorServiceUrl, createApolloClient } from 'utils/apolloClient';
import { bytes32ToCid, cat, cidToBytes32, IPFS_PROJECT_CLIENT } from 'utils/ipfs';
import { wrapGqlUrl } from 'utils/project';
import {
  GET_PROJECT,
  GET_QUERY_METADATA,
  GET_REGISTRY_VERSIONS,
  getIndexerStatus,
} from 'utils/queries';

import { useGetIndexerMetadataCid } from './transactionHook';

const metadataInitValue = {
  lastHeight: 0,
  lastTime: 0,
  startHeight: 0,
  targetHeight: 0,
  chain: '',
  specName: '',
  genesisHash: '',
  indexerNodeVersion: '',
  queryNodeVersion: '',
  indexerStatus: dockerContainerEnum.TERMINATED,
  queryStatus: dockerContainerEnum.TERMINATED,
};

const coordinatorClient = createApolloClient(coordinatorServiceUrl);

export const useProjectDetails = (deploymentId: string) => {
  const projectQuery = useQuery<{ project: ProjectDetails }>(GET_PROJECT, {
    fetchPolicy: 'network-only',
    variables: { id: deploymentId },
  });

  return projectQuery;
};

export const getQueryMetadata = async (id: string, type: number): Promise<TQueryMetadata> => {
  try {
    const result = await coordinatorClient.query<{ serviceMetadata: TQueryMetadata }>({
      query: GET_QUERY_METADATA,
      variables: { id, projectType: type },
      fetchPolicy: 'network-only',
    });
    return result.data.serviceMetadata;
  } catch {
    return metadataInitValue;
  }
};

export const useDeploymentStatus = (deploymentId: string) => {
  const [status, setStatus] = useState<ServiceStatus | undefined>();
  const { indexer: account } = useCoordinatorIndexer();
  const sdk = useContractSDK();

  const getDeploymentStatus = useCallback(async () => {
    if (!sdk || !account || !deploymentId) return;
    const status = await sdk.projectRegistry.deploymentStatusByIndexer(
      cidToBytes32(deploymentId),
      account
    );

    setStatus(status);
  }, [sdk, account, deploymentId]);

  useEffect(() => {
    getDeploymentStatus();
  }, [getDeploymentStatus]);

  return {
    status,
    getDeploymentStatus,
  };
};

export const getManifest = async (cid: string) => {
  const projectYaml = await cat(cid, IPFS_PROJECT_CLIENT);
  const resultManifest = yaml.load(projectYaml) as PartialIpfsDeploymentManifest;
  return resultManifest;
};

// TODO optimize
export const useGetIndexerMetadata = (indexer: string) => {
  const metadataCid = useGetIndexerMetadataCid(indexer);
  const [metadata, setMetadata] = useState<{ name: string; url: string }>();

  const getMetadata = async (cid: string) => {
    const indexerMetadata = await cat(bytes32ToCid(cid), IPFS_PROJECT_CLIENT);
    setMetadata(indexerMetadata);
  };

  useEffect(() => {
    if (metadataCid) {
      getMetadata(metadataCid);
    }
  }, [metadataCid]);

  return metadata;
};

export function dockerRegistryFromChain(chainType: ChainType): string {
  switch (chainType) {
    case 'cosmos':
    case 'algorand':
    case 'flare':
    case 'near':
    case 'ethereum':
      return `subquerynetwork/subql-node-${chainType}`;
    default:
      return 'subquerynetwork/subql-node-substrate';
  }
}

const defaultRange: Record<ChainType, string> = {
  substrate: '>=3.1.0',
  cosmos: '>=3.1.0',
  flare: '>=3.1.0',
  algorand: '>=3.0.1',
  near: '>=3.0.0',
  ethereum: '>=3.1.0',
  stellar: '>=3.0.1',
};

export const useFetchManifest = () => {
  const fetchManifest = useCallback(async (cid: string) => {
    const manifest = await getManifest(cid);
    return manifest;
  }, []);

  return fetchManifest;
};

export const useNodeVersions = (cid: string): string[] => {
  const [getNodeVersions, { data }] = useLazyQuery(GET_REGISTRY_VERSIONS);

  const fetchNodeVersions = useCallback(async () => {
    const manifest = await getManifest(cid);
    const { dataSources, runner } = manifest;
    const runtime = dataSources?.[0].kind;
    const chainType = runtime?.split('/')?.[0] as ChainType;

    const registry = dockerRegistryFromChain(chainType);
    const range = runner?.node?.version ?? defaultRange[chainType];
    getNodeVersions({ variables: { range, registry } });
  }, [cid, getNodeVersions]);

  useEffect(() => {
    fetchNodeVersions();
  }, [fetchNodeVersions]);

  const versions = useMemo(() => data?.getRegistryVersions, [data?.getRegistryVersions]);
  return !isEmpty(versions) ? versions : [];
};

export const useQueryVersions = (cid: string): string[] => {
  const [getQueryVersions, { data }] = useLazyQuery(GET_REGISTRY_VERSIONS);

  const fetchQueryVersions = useCallback(async () => {
    const manifest = await getManifest(cid);
    const range = manifest.runner?.query?.version ?? '>=0.15.0';
    getQueryVersions({ variables: { range, registry: DockerRegistry.query } });
  }, [cid, getQueryVersions]);

  useEffect(() => {
    fetchQueryVersions();
  }, [fetchQueryVersions]);

  const versions = data?.getRegistryVersions;
  return !isEmpty(versions) ? versions : [];
};

export const useIsOnline = (props: {
  deploymentId: string;
  indexer: string;
  interval?: number;
}) => {
  const { deploymentId, indexer, interval = 30000 } = props;
  const [online, setOnline] = useState(false);
  const metadata = useGetIndexerMetadata(indexer);

  const getProjectUptimeStatus = async () => {
    const res = await getIndexerStatus({
      deploymentId,
      indexer,
    });

    if (res.status === NetworkStatus.ready) {
      if (res.data.getIndexerServiceStatus) {
        const status = res.data.getIndexerServiceStatus.endpointSuccess;
        setOnline(res.data.getIndexerServiceStatus.endpointSuccess);
        return status;
      }
    }

    return false;
  };

  const getProjectUptimeStatusFromGqlProxy = async () => {
    if (!metadata?.url) return;
    try {
      const res = await axios.get<{
        data: {
          _metadata: TQueryMetadata;
        };
      }>(
        wrapGqlUrl({
          indexer,
          url: `${metadata.url}/metadata/${deploymentId}`,
        })
      );

      if (res.status === 200) {
        // eslint-disable-next-line no-underscore-dangle
        if (res.data?.data?._metadata?.healthy) {
          setOnline(true);
        }
      }
    } catch (e) {
      // actually don't care this error.
      console.log(e);
    }
  };

  const getOnlineStatus = async () => {
    if (online) return;
    const fromExcellency = await getProjectUptimeStatus();

    if (fromExcellency) return;

    getProjectUptimeStatusFromGqlProxy();
  };

  useEffect(() => {
    getOnlineStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deploymentId, indexer, metadata]);

  useInterval(() => {
    getProjectUptimeStatus();
  }, interval);

  return online;
};
