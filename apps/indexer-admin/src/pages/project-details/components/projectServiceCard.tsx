// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { FC, useMemo } from 'react';
import { Tag, Typography } from '@subql/components';
import { Button } from 'antd';
import styled from 'styled-components';

import { Text } from 'components/primary';
import { useAccount } from 'containers/account';
import { useGetIndexerMetadata } from 'hooks/projectHook';
import { statusCode } from 'utils/project';

import { ButtonItem } from '../config';
import { CardContainer } from '../styles';
import { ProjectStatus, TQueryMetadata } from '../types';

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
  margin-right: 30px;
`;

const HeaderContainer = styled.div`
  display: flex;
  align-items: center;
`;

type CardProps = {
  title: string;
  subTitle: string;
  status?: string;
};

const ServiceView: FC<CardProps> = ({ title, subTitle, status }) => (
  <ServiceContaineer>
    <HeaderContainer>
      <Text mr={20} fw="500">
        {title}
      </Text>
      {!!status && <Tag state={statusCode(status)}>{status}</Tag>}
    </HeaderContainer>
    <Text size={15} color="gray" mt={10}>
      {subTitle}
    </Text>
  </ServiceContaineer>
);

type Props = {
  id: string;
  actionItems: ButtonItem[];
  data?: TQueryMetadata;
  projectStatus: ProjectStatus;
  update: () => void;
  stop: () => void;
};

const ProjectServiceCard: FC<Props> = ({ id, data, projectStatus, update, stop }) => {
  const { account } = useAccount();
  const indexMetadata = useGetIndexerMetadata(account || '');

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
      ].includes(projectStatus)
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
  }, [projectStatus, update, stop]);

  if (!data) return null;

  const imageVersion = (type: string, version: string) => `onfinality/subql-${type}:${version}`;

  return (
    <CardContainer>
      <div>
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
            subTitle={`Image Version: ${imageVersion('indexer', data.indexerNodeVersion)}`}
            status={data.indexerStatus}
          />
          <ServiceView
            title="Query Service"
            subTitle={`Image Version: ${imageVersion('query', data.queryNodeVersion)}`}
            status={data.queryStatus}
          />
          <ServiceView
            title="Proxy Service"
            subTitle={`Url: ${new URL(`/query/${id}`, indexMetadata?.url || window.location.href)}`}
            status={data.queryStatus}
          />
        </ContentContainer>
      </div>
    </CardContainer>
  );
};

export default ProjectServiceCard;
