// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { FC, useEffect } from 'react';
import { GithubOutlined, GlobalOutlined } from '@ant-design/icons';
import { useLazyQuery } from '@apollo/client';
import { Markdown, SubqlCard, Typography } from '@subql/components';
import styled from 'styled-components';

import { GET_MANIFEST, ManiFest } from 'utils/queries';

import { ProjectDetails, ProjectType } from '../types';

type Props = {
  id: string;
  project: ProjectDetails;
};

const ProjectDetailsView: FC<Props> = ({ project }) => {
  const { description, websiteUrl, codeUrl } = project.details;
  const [getManifest, manifest] = useLazyQuery<ManiFest>(GET_MANIFEST);

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

        {project.projectType === ProjectType.Rpc && (
          <>
            <SplitLine />
            <Typography>RPC Endpoint Details</Typography>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Typography type="secondary" variant="medium">
                  Chain ID:
                </Typography>
                <Typography variant="medium">
                  {manifest.data?.getManifest.rpcManifest?.chain.chainId}
                </Typography>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Typography type="secondary" variant="medium">
                  Family:
                </Typography>
                <Typography variant="medium">
                  {manifest.data?.getManifest.rpcManifest?.rpcFamily.join(' ')}
                </Typography>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Typography type="secondary" variant="medium">
                  Client:
                </Typography>
                <Typography variant="medium">
                  {manifest.data?.getManifest.rpcManifest?.client?.name || 'Unknown'}
                </Typography>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Typography type="secondary" variant="medium">
                  Node type:
                </Typography>
                <Typography variant="medium">
                  {manifest.data?.getManifest.rpcManifest?.nodeType}
                </Typography>
              </div>
            </div>
          </>
        )}
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

const SplitLine = styled.div`
  width: 100%;
  height: 1px;
  background: var(--sq-gray300);
  margin: 16px 0;
`;

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
