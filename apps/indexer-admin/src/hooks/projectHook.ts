// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { NetworkStatus, useLazyQuery, useQuery } from '@apollo/client';
import { _Metadata } from '@subql/network-query';
import { useInterval } from 'ahooks';
import axios from 'axios';
import yaml from 'js-yaml';
import { isEmpty } from 'lodash';
import { useCallback, useEffect, useState } from 'react';

import { useAccount } from 'containers/account';
import { useContractSDK } from 'containers/contractSdk';
import { useNotification } from 'containers/notificationContext';
import {
  ChainType,
  dockerContainerEnum,
  DockerRegistry,
  PartialIpfsDeploymentManifest,
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
  lastProcessedHeight: 0,
  lastProcessedTimestamp: 0,
  startHeight: 0,
  targetHeight: 0,
  chain: '',
  specName: '',
  genesisHash: '',
  indexerHealthy: undefined,
  indexerNodeVersion: '',
  queryNodeVersion: '',
  indexerStatus: dockerContainerEnum.TERMINATED,
  queryStatus: dockerContainerEnum.TERMINATED,
};

const coordinatorClient = createApolloClient(coordinatorServiceUrl);

export const useProjectDetails = (deploymentId: string) => {
  const { notification } = useNotification();
  // TODO add type
  const projectQuery = useQuery(GET_PROJECT, {
    fetchPolicy: 'network-only',
    variables: { id: deploymentId },
  });

  useEffect(() => {
    projectQuery.refetch();
  }, [projectQuery, notification?.type]);

  return projectQuery;
};

export const useServiceStatus = (deploymentId: string): ServiceStatus | undefined => {
  const [status, setStatus] = useState<ServiceStatus>(ServiceStatus.TERMINATED);
  const { account } = useAccount();
  const notificationContext = useNotification();
  const sdk = useContractSDK();

  useEffect(() => {
    if (sdk && account && deploymentId) {
      sdk.projectRegistry
        .deploymentStatusByIndexer(cidToBytes32(deploymentId), account)
        .then((status) => {
          setStatus(status);
        })
        .catch((error) => console.error(error));
    }
  }, [sdk, account, deploymentId, notificationContext.notification?.type]);

  return status;
};

export const getQueryMetadata = async (id: string): Promise<TQueryMetadata> => {
  try {
    const result = await coordinatorClient.query<{ queryMetadata: TQueryMetadata }>({
      query: GET_QUERY_METADATA,
      variables: { id },
      fetchPolicy: 'network-only',
    });
    return result.data.queryMetadata;
  } catch {
    return metadataInitValue;
  }
};

export const useDeploymentStatus = (deploymentId: string) => {
  const [status, setStatus] = useState<ServiceStatus | undefined>();
  const { account } = useAccount();
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

  return status;
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

function dockerRegistryFromChain(chainType: ChainType): string {
  switch (chainType) {
    case 'cosmos':
    case 'algorand':
    case 'flare':
    case 'near':
    case 'ethereum':
      return `onfinality/subql-node-${chainType}`;
    default:
      return 'onfinality/subql-node';
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

export const useNodeVersions = (cid: string): string[] => {
  const [getNodeVersions, { data }] = useLazyQuery(GET_REGISTRY_VERSIONS);

  const fetchNodeVersions = useCallback(async () => {
    const manifest = await getManifest(cid);
    const { dataSources, runner } = manifest;
    const runtime = dataSources[0].kind;
    const chainType = runtime.split('/')[0] as ChainType;

    const registry = dockerRegistryFromChain(chainType);
    const range = runner?.node?.version ?? defaultRange[chainType];
    getNodeVersions({ variables: { range, registry } });
  }, [cid, getNodeVersions]);

  useEffect(() => {
    fetchNodeVersions();
  }, [fetchNodeVersions]);

  const versions = data?.getRegistryVersions;
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
      if (res.data.getIndexerStatus) {
        const status =
          res.data.getIndexerStatus.nodeSuccess && res.data.getIndexerStatus.querySuccess;
        setOnline(status);
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
          _metadata: _Metadata;
        };
      }>(
        wrapGqlUrl({
          indexer,
          url: `${metadata.url}/metadata/${deploymentId}`,
        })
      );

      if (res.status === 200) {
        // eslint-disable-next-line no-underscore-dangle
        if (res.data?.data?._metadata?.indexerHealthy) {
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
