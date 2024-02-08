// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { FC, useEffect } from 'react';
import { useLazyQuery } from '@apollo/client';
import { Spinner, Tag, Typography } from '@subql/components';
import { Button } from 'antd';
import { isUndefined } from 'lodash';
import styled from 'styled-components';

import Avatar from 'components/avatar';
import { Separator } from 'components/primary';
import { TagItem } from 'components/tagItem';
import UnsafeWarn from 'components/UnsafeWarn';
import { useGetIfUnsafeDeployment } from 'hooks/useGetIfUnsafeDeployment';
import { statusText } from 'pages/projects/constant';
import { cidToBytes32 } from 'utils/ipfs';
import { serviceStatusCode } from 'utils/project';
import { GET_MANIFEST, ManiFest } from 'utils/queries';

import { ProjectDetails, ProjectType, ServiceStatus } from '../types';

type Props = {
  id: string;
  project: ProjectDetails;
  onRemoveProject: () => void;
  status?: ServiceStatus;
  announceReady: () => void;
  announceStop: () => void;
};

const ProjectDetailsHeader: FC<Props> = ({
  id,
  project,
  status,
  announceReady,
  announceStop,
  onRemoveProject,
}) => {
  const [getManifest, manifest] = useLazyQuery<ManiFest>(GET_MANIFEST);
  const { isUnsafe } = useGetIfUnsafeDeployment(id);

  useEffect(() => {
    if (project.projectType === ProjectType.Rpc) {
      getManifest({
        variables: {
          projectId: project.id,
        },
      });
    }
  }, [project, getManifest]);
  return (
    <Container>
      <LeftContainer>
        <Avatar address={cidToBytes32(id)} size={144} />
        <ContentContainer style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography
              variant="h4"
              weight={600}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              {project.details.name}
              {!isUndefined(status) ? (
                <Tag color={serviceStatusCode(status)}>{statusText[status]}</Tag>
              ) : (
                <Spinner />
              )}
              {isUnsafe && <UnsafeWarn />}
            </Typography>

            <div>
              {status === ServiceStatus.TERMINATED && (
                <Button
                  size="large"
                  shape="round"
                  type="primary"
                  onClick={() => {
                    announceReady();
                  }}
                >
                  Go Online
                </Button>
              )}
              {status === ServiceStatus.READY && (
                <Button
                  size="large"
                  shape="round"
                  type="primary"
                  style={{ marginLeft: 16 }}
                  onClick={() => {
                    announceStop();
                  }}
                >
                  Go Offline
                </Button>
              )}

              {status === ServiceStatus.TERMINATED && (
                <Button
                  shape="round"
                  size="large"
                  danger
                  type="text"
                  onClick={() => {
                    onRemoveProject();
                  }}
                >
                  Remove
                </Button>
              )}
            </div>
          </div>
          <Typography variant="medium" style={{ marginTop: 8 }}>
            {project.details.owner}
          </Typography>
          <VersionContainer style={{ justifyContent: 'flex-start' }}>
            {project.projectType === ProjectType.SubQuery && (
              <>
                <TagItem
                  versionType="Indexed Network"
                  value={project.metadata?.chain || 'Unknown'}
                />
                <Separator height={30} mr={36} ml={36} />
              </>
            )}
            <TagItem
              versionType="Project Type"
              value={project.projectType === ProjectType.Rpc ? 'RPC Service' : 'SubQuery Project'}
            />
            <Separator height={30} mr={36} ml={36} />

            {project.projectType === ProjectType.Rpc && (
              <>
                <TagItem
                  versionType="Network"
                  value={manifest.data?.getManifest.rpcManifest?.rpcFamily.join(' ')}
                />
                <Separator height={30} mr={36} ml={36} />

                <TagItem
                  versionType="Node Type"
                  value={manifest.data?.getManifest.rpcManifest?.nodeType}
                />
                <Separator height={30} mr={36} ml={36} />

                <TagItem
                  versionType="Client Name"
                  value={manifest.data?.getManifest.rpcManifest?.client?.name || 'Unkonwn'}
                />
                <Separator height={30} mr={36} ml={36} />
              </>
            )}

            <TagItem versionType="Deployment ID" value={project.id} />
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
  margin-left: 24px;
`;

const VersionContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 14px;
  height: 50px;
`;
