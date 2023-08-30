// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { FC } from 'react';
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
  const { description, websiteUrl, codeUrl, createdTimestamp, updatedTimestamp } = project.details;
  return (
    <Container>
      <LeftContainer>
        <InfoView title="Description" desc={description} />
        <BottomContainer>
          <InfoView title="Created" desc={formatDate(createdTimestamp)} />
          <InfoView ml={150} title="Last Updated" desc={formatDate(updatedTimestamp)} />
        </BottomContainer>
      </LeftContainer>
      <RightContainer>
        <InfoView title="Deployment ID" desc={project.id} />
        <InfoView mt={30} title="Website URL" desc={websiteUrl} />
        <InfoView mt={30} title="Source Code URL" desc={codeUrl} />
      </RightContainer>
    </Container>
  );
};

export default ProjectDetailsView;

const Container = styled.div`
  display: flex;
  min-height: 350px;
  margin-top: 20px;
`;

const LeftContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-width: 500px;
  width: 45%;
`;

const BottomContainer = styled.div`
  display: flex;
  align-items: center;
  margin-top: 50px;
`;

const RightContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  margin-left: 80px;
`;

const InfoContainer = styled.div<{ mt?: number; ml?: number }>`
  display: flex;
  flex-direction: column;
  margin-left: ${({ ml }) => ml ?? 0}px;
  margin-top: ${({ mt }) => mt ?? 0}px;
`;
