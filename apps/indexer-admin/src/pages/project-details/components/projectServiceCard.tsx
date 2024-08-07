// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { FC, useMemo } from 'react';
import { Tag, Typography } from '@subql/components';
import { useAsyncMemo } from '@subql/react-hooks';
import { Button } from 'antd';
import styled from 'styled-components';

import { useCoordinatorIndexer } from 'containers/coordinatorIndexer';
import {
  dockerRegistryFromChain,
  useFetchManifest,
  useGetIndexerMetadata,
} from 'hooks/projectHook';
import { statusCode } from 'utils/project';

import { ButtonItem } from '../config';
import { CardContainer } from '../styles';
import { ChainType, ProjectDetails, ProjectStatus, TQueryMetadata } from '../types';

const ContentContainer = styled.div`
  display: flex;
  background-color: white;
  border-radius: 8px;
`;

const ServiceContaineer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 200px;
  margin-right: 16px;
  position: relative;
  & + & {
    padding-left: 16px;
    &::before {
      position: absolute;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
      content: ' ';
      height: 20px;
      width: 1px;
      background: var(--sq-gray400);
    }
  }
`;

const HeaderContainer = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 8px;
`;

type CardProps = {
  title: string;
  subTitle: string;
  status?: string;
};

const ServiceView: FC<CardProps> = ({ title, subTitle, status }) => (
  <ServiceContaineer>
    <HeaderContainer>
      <Typography variant="medium" type="secondary" style={{ marginRight: 8 }}>
        {title}
      </Typography>

      {!!status && <Tag color={statusCode(status)}>{status}</Tag>}
    </HeaderContainer>
    <Typography variant="medium">{subTitle}</Typography>
  </ServiceContaineer>
);

type Props = {
  id: string;
  actionItems: ButtonItem[];
  data?: TQueryMetadata;
  projectStatus: ProjectStatus;
  project: ProjectDetails;
  update: () => void;
  stop: () => void;
};

const ProjectServiceCard: FC<Props> = ({ id, data, project, projectStatus, update, stop }) => {
  const { indexer: account } = useCoordinatorIndexer();
  const indexMetadata = useGetIndexerMetadata(account || '');

  const fetchManifest = useFetchManifest();

  const connectionButtons = useMemo(() => {
    const btns = [];

    if (
      [
        ProjectStatus.NotIndexing,
        ProjectStatus.Indexing,
        ProjectStatus.Ready,
        ProjectStatus.Started,
        ProjectStatus.Starting,
        ProjectStatus.Unhealthy,
        ProjectStatus.Terminated,
      ].includes(projectStatus)
    ) {
      // update
      btns.push(
        <Button
          key="update"
          type="primary"
          onClick={() => {
            update();
          }}
          shape="round"
          style={{ borderColor: 'var(--sq-blue600)', background: 'var(--sq-blue600)' }}
          size="large"
        >
          Update
        </Button>
      );
    }

    if (
      [
        ProjectStatus.Indexing,
        ProjectStatus.Ready,
        ProjectStatus.Started,
        ProjectStatus.Starting,
      ].includes(projectStatus) &&
      project.hostType !== 'user-managed'
    ) {
      // stop
      btns.push(
        <Button
          key="stop"
          type="primary"
          danger
          onClick={() => {
            stop();
          }}
          shape="round"
          size="large"
        >
          Stop
        </Button>
      );
    }

    return btns;
  }, [projectStatus, update, stop, project.hostType]);

  const hostType = useMemo(() => {
    return project.hostType;
  }, [project.hostType]);

  const versionType = useAsyncMemo(async () => {
    try {
      const manifest = await fetchManifest(id);
      const { dataSources } = manifest;
      const runtime = dataSources?.[0].kind;
      const chainType = runtime?.split('/')?.[0] as ChainType;
      const registry = dockerRegistryFromChain(chainType);
      return registry;
    } catch {
      return 'indexer';
    }
  }, [id]);

  if (!data) return null;

  const imageVersion = (type: string, version: string) => `${type}:${version}`;

  return (
    <CardContainer>
      <div style={{ width: '100%' }}>
        <div style={{ display: 'flex', gap: 16 }}>
          <Typography variant="large" weight={600} style={{ marginBottom: 16 }}>
            Project Connection Settings
          </Typography>
          <span style={{ flex: 1 }} />
          {connectionButtons}
        </div>
        <ContentContainer>
          <ServiceView
            title="Indexer Service"
            subTitle={
              hostType === 'user-managed'
                ? `${
                    project?.projectConfig?.serviceEndpoints?.find((i) => i.key === 'nodeEndpoint')
                      ?.value || ''
                  }`
                : `${imageVersion(versionType.data || 'indexer', data.indexerNodeVersion)}`
            }
            status={data.indexerStatus}
          />
          <ServiceView
            title="Query Endpoint"
            subTitle={
              hostType === 'user-managed'
                ? `${
                    project?.projectConfig?.serviceEndpoints?.find((i) => i.key === 'queryEndpoint')
                      ?.value || ''
                  }`
                : `${new URL(`/query/${id}`, indexMetadata?.url || window.location.href)}`
            }
            status={data.queryStatus}
          />
          <ServiceView title="Rate Limit" subTitle={`${project.rateLimit || '∞'} rps`} />
        </ContentContainer>
      </div>
    </CardContainer>
  );
};

export default ProjectServiceCard;
