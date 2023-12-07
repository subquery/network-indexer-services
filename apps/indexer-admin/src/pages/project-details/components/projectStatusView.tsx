// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { FC } from 'react';
import { Spinner, Tag } from '@subql/components';
import { Button, Progress } from 'antd';
import { isUndefined } from 'lodash';
import styled from 'styled-components';

import { Text } from 'components/primary';
import { TagItem } from 'components/tagItem';
import { statusText } from 'pages/projects/constant';
import { serviceStatusCode } from 'utils/project';
import { formatValueToFixed } from 'utils/units';

import { CardContainer } from '../styles';
import { ServiceStatus, TQueryMetadata } from '../types';

const ContentContainer = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
`;

const TagsContainer = styled.div<{ mb?: number }>`
  display: flex;
  min-width: 230px;
  margin: 15px 0px;
`;

const LabelContainer = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 15px;
`;

type Props = {
  percent: number;
  status?: ServiceStatus;
  metadata?: TQueryMetadata;
  announceReady: () => void;
  announceStop: () => void;
};

const ProjectStatusView: FC<Props> = ({
  percent,
  status,
  metadata,
  announceReady,
  announceStop,
}) => {
  return (
    <CardContainer>
      <ContentContainer>
        <LabelContainer>
          <Text size={15} fw="500" mr={10}>
            Indexing Status
          </Text>
          {!isUndefined(status) ? (
            <Tag state={serviceStatusCode(status)}>{statusText[status]}</Tag>
          ) : (
            <Spinner />
          )}

          <span style={{ flex: 1 }} />

          <Button
            size="large"
            shape="round"
            type="primary"
            disabled={status === ServiceStatus.READY}
            onClick={() => {
              announceReady();
            }}
          >
            Announce Ready
          </Button>
          <Button
            size="large"
            shape="round"
            type="primary"
            style={{ marginLeft: 16 }}
            disabled={status === ServiceStatus.TERMINATED}
            onClick={() => {
              announceStop();
            }}
          >
            Announce Stop
          </Button>
        </LabelContainer>
        {!!metadata?.targetHeight && (
          <TagsContainer>
            <TagItem
              horizontal
              versionType="Latest Block"
              prefix="#"
              value={metadata.targetHeight}
            />
            <TagItem
              horizontal
              versionType="Indexing Block"
              prefix="#"
              value={metadata.lastHeight}
            />
          </TagsContainer>
        )}
        <Progress percent={formatValueToFixed(percent * 100)} />
      </ContentContainer>
    </CardContainer>
  );
};

export default ProjectStatusView;
