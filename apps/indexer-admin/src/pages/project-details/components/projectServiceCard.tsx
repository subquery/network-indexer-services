// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { FC, useMemo, useState } from 'react';
import { Button, Tag, Typography } from '@subql/components';
import { Drawer } from 'antd';
import styled from 'styled-components';

import { Text } from 'components/primary';
import { useAccount } from 'containers/account';
import { useGetIndexerMetadata } from 'hooks/projectHook';
import { statusCode } from 'utils/project';

import { ButtonItem } from '../config';
import { ActionContainer, CardContainer } from '../styles';
import { ProjectStatus, ProjectType, TQueryMetadata } from '../types';
import RpcSetting from './rpcSetting';

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
  type: ProjectType;
  projectStatus: ProjectStatus;
};

const ProjectServiceCard: FC<Props> = ({ id, actionItems, data, type, projectStatus }) => {
  const { account } = useAccount();
  const indexMetadata = useGetIndexerMetadata(account || '');
  const [showRpcDrawer, setShowRpcDrawer] = useState(false);
  const rpcButtons = useMemo(() => {
    const btns = [];
    if ([ProjectStatus.NotIndexing].includes(projectStatus)) {
      // start
      btns.push(
        <Button
          label="Start Indexing"
          type="primary"
          onClick={() => {
            setShowRpcDrawer(true);
          }}
        />
      );
    }

    if (
      [
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
          label="Update Indexing"
          type="primary"
          onClick={() => {
            setShowRpcDrawer(true);
          }}
        />
      );
    }

    if (
      [ProjectStatus.Terminated, ProjectStatus.NotIndexing, ProjectStatus.Unhealthy].includes(
        projectStatus
      )
    ) {
      // remove
      btns.push(<Button label="Remove Project" type="secondary" />);
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
      btns.push(<Button label="Stop Project" type="secondary" />);
    }

    return btns;
  }, [projectStatus]);

  if (!data) return null;

  const imageVersion = (type: string, version: string) => `onfinality/subql-${type}:${version}`;

  return (
    <CardContainer>
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
      <ActionContainer>
        {type === ProjectType.SubQuery
          ? actionItems.map(({ title, action, options = { type: 'secondary' } }) => (
              <Button
                key={title}
                title={title}
                onClick={action}
                type={options.type}
                label={title}
              />
            ))
          : rpcButtons}
      </ActionContainer>

      <Drawer
        open={showRpcDrawer}
        rootClassName="popupViewDrawer"
        width="30%"
        onClose={() => {
          setShowRpcDrawer(false);
        }}
        title={<Typography> Update Project Setting </Typography>}
        footer={null}
      >
        <RpcSetting
          onCancel={() => {
            setShowRpcDrawer(false);
          }}
          onSubmit={() => {
            setShowRpcDrawer(false);
          }}
        />
      </Drawer>
    </CardContainer>
  );
};

export default ProjectServiceCard;
