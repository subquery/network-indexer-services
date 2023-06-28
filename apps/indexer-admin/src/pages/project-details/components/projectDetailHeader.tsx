// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { FC } from 'react';
import { Tag, TagProps } from '@subql/components';
import styled from 'styled-components';

import Avatar from 'components/avatar';
import { Separator, Text } from 'components/primary';
import { TagItem } from 'components/tagItem';
import { cidToBytes32 } from 'utils/ipfs';

import { ProjectDetails, ProjectStatus } from '../types';

type Props = {
  id: string;
  project: ProjectDetails;
  projectStatus: ProjectStatus;
  onlineStatus: boolean;
};

const getProjectStatusTagState = (status: ProjectStatus): TagProps['state'] => {
  if (status === ProjectStatus.Ready) return 'success';
  if (status === ProjectStatus.Started || status === ProjectStatus.Indexing) return 'info';
  return 'default';
};

const ProjectDetailsHeader: FC<Props> = ({ id, projectStatus, project, onlineStatus }) => {
  return (
    <Container>
      <LeftContainer>
        <Avatar address={cidToBytes32(id)} size={100} />
        <ContentContainer>
          <Text fw="600" size={30}>
            {project.details.name}
          </Text>
          <Text fw="400" size={15}>
            {project.details.owner}
          </Text>
          <VersionContainer>
            <TagItem versionType="INDEXED NETWORK" value={project.metadata?.chain} />
            <Separator height={30} mr={36} ml={36} />
            <TagItem versionType="VERSION" value={`V${project.details.version ?? '1.0.0'}`} />
            <Separator height={30} mr={36} ml={36} />
            <TagItem versionType="PROJECT STATUS" fw="normal">
              <Tag state={getProjectStatusTagState(projectStatus)}>{projectStatus}</Tag>
            </TagItem>
            <Separator height={30} mr={36} ml={36} />
            <TagItem versionType="UPTIME" fw="normal">
              <Tag state={onlineStatus ? 'success' : 'error'}>
                {onlineStatus ? 'You are Connectable' : 'You are not Connectable'}
              </Tag>
            </TagItem>
          </VersionContainer>
        </ContentContainer>
      </LeftContainer>
    </Container>
  );
};

export default ProjectDetailsHeader;

const Container = styled.div`
  display: flex;
  justify-content: space-between;
  min-height: 200px;
  padding-right: 32px;
`;

const LeftContainer = styled.div`
  display: flex;
  flex: 1;
  align-items: center;
  min-width: 685px;
`;

const ContentContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  margin-left: 40px;
`;

const VersionContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 25px;
  height: 50px;
`;
