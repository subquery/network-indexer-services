// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { FC } from 'react';
import { Tag } from '@subql/components';
import { ProgressBar, Spinner } from '@subql/react-ui';
import { isUndefined } from 'lodash';
import styled from 'styled-components';

import { Button, Text } from 'components/primary';
import { TagItem } from 'components/tagItem';
import { statusText } from 'pages/projects/constant';
import { indexingStatusCode } from 'utils/project';

import { ButtonItem } from '../config';
import { ActionContainer, CardContainer } from '../styles';
import { IndexingStatus, TQueryMetadata } from '../types';

const ContentContainer = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  margin-right: 50px;
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
  actionItems: ButtonItem[];
  status?: IndexingStatus;
  metadata?: TQueryMetadata;
};

const ProjectStatusView: FC<Props> = ({ percent, actionItems, status, metadata }) => (
  <CardContainer>
    <ContentContainer>
      <LabelContainer>
        <Text size={15} fw="500" mr={10}>
          Indexing Status
        </Text>
        {!isUndefined(status) ? (
          <Tag state={indexingStatusCode(status)}>{statusText[status]}</Tag>
        ) : (
          <Spinner />
        )}
      </LabelContainer>
      {!!metadata?.targetHeight && (
        <TagsContainer>
          <TagItem horizontal versionType="Latest Block" prefix="#" value={metadata.targetHeight} />
          <TagItem
            horizontal
            versionType="Indexing Block"
            prefix="#"
            value={metadata.lastProcessedHeight}
          />
        </TagsContainer>
      )}
      <ProgressBar progress={percent / 100} />
    </ContentContainer>
    <ActionContainer>
      {actionItems.map(({ title, action }) => (
        <Button mt={10} key={title} width={265} title={title} onClick={action} />
      ))}
    </ActionContainer>
  </CardContainer>
);

export default ProjectStatusView;
