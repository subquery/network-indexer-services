// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { FC } from 'react';
import { SubqlProgress, Typography } from '@subql/components';
import styled from 'styled-components';

import { TagItem } from 'components/tagItem';
import { formatValueToFixed } from 'utils/units';

import { CardContainer } from '../styles';
import { TQueryMetadata } from '../types';

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
  metadata?: TQueryMetadata;
};

const ProjectStatusView: FC<Props> = ({ percent, metadata }) => {
  return (
    <CardContainer>
      <ContentContainer>
        <LabelContainer>
          <Typography variant="h6" weight={500}>
            Syncing Status
          </Typography>

          <span style={{ flex: 1 }} />
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
        <SubqlProgress percent={formatValueToFixed(percent * 100)} />
      </ContentContainer>
    </CardContainer>
  );
};

export default ProjectStatusView;
