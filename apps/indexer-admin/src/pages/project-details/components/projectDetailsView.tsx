// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { FC } from 'react';
import { GithubOutlined, GlobalOutlined } from '@ant-design/icons';
import { Markdown, SubqlCard, Typography } from '@subql/components';
import styled from 'styled-components';

import { Text } from 'components/primary';

import { ProjectDetails } from '../types';

type InfoProps = {
  title: string;
  desc: string;
  ml?: number;
  mt?: number;
};

const InfoView: FC<InfoProps> = ({ title, desc, ml, mt }) => (
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  <InfoContainer ml={ml} mt={mt}>
    <Text size={18}>{title}</Text>
    <Text mt={15} size={16} color="gray">
      {desc}
    </Text>
  </InfoContainer>
);

type Props = {
  id: string;
  project: ProjectDetails;
};

const formatDate = (date: string) => new Date(date).toLocaleDateString();

const ProjectDetailsView: FC<Props> = ({ project }) => {
  const { description, websiteUrl, codeUrl } = project.details;
  return (
    <Container>
      <Left>
        <Markdown.Preview>{description}</Markdown.Preview>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              color: 'var(--sq-blue600)',
              gap: 8,
            }}
          >
            <GlobalOutlined />
            <Typography variant="medium">{websiteUrl}</Typography>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              color: 'var(--sq-blue600)',
              gap: 8,
            }}
          >
            <GithubOutlined />
            <Typography variant="medium">{codeUrl}</Typography>
          </div>
        </div>
      </Left>
      <Right>
        <SubqlCard title="Totoal Rewards">
          <div>123</div>
        </SubqlCard>
      </Right>
    </Container>
  );
};

export default ProjectDetailsView;

const Left = styled.div`
  display: flex;
  flex-direction: column;
  max-width: 713px;
  flex: 1;
`;

const Right = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
`;

const Container = styled.div`
  display: flex;
  min-height: 350px;
  margin-top: 20px;
  gap: 48px;
`;

const InfoContainer = styled.div<{ mt?: number; ml?: number }>`
  display: flex;
  flex-direction: column;
  margin-left: ${({ ml }) => ml ?? 0}px;
  margin-top: ${({ mt }) => mt ?? 0}px;
`;
