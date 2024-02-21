// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { FC, useEffect } from 'react';
import { GithubOutlined, GlobalOutlined } from '@ant-design/icons';
import { useLazyQuery, useQuery } from '@apollo/client';
import { Markdown, SubqlCard, Typography } from '@subql/components';
import { TOKEN_SYMBOLS } from '@subql/network-config';
import { formatSQT } from '@subql/react-hooks';
import { Tooltip } from 'antd';
import styled from 'styled-components';

import {
  GET_MANIFEST,
  GET_PROJECT_REWARDS_DETAILS,
  GetProjectRewardsDetails,
  ManiFest,
} from 'utils/queries';
import { formatNumber } from 'utils/units';
import { SUPPORTED_NETWORK } from 'utils/web3';

import { ProjectDetails, ProjectType } from '../types';

type Props = {
  id: string;
  project: ProjectDetails;
};

export const BalanceLayout = ({
  mainBalance,
  secondaryBalance,
  secondaryTooltip = 'Estimated for next Era',
  token = TOKEN_SYMBOLS[SUPPORTED_NETWORK],
}: {
  mainBalance: number | string;
  secondaryBalance?: number | string;
  secondaryTooltip?: React.ReactNode;
  token?: string;
}) => {
  const secondaryRender = () => {
    if (!secondaryBalance)
      return (
        <Typography variant="small" type="secondary" style={{ visibility: 'hidden' }}>
          bigo
        </Typography>
      );
    return secondaryTooltip ? (
      <Tooltip title={secondaryTooltip} placement="topLeft">
        <Typography variant="small" type="secondary">
          {formatNumber(secondaryBalance)} {token}
        </Typography>
      </Tooltip>
    ) : (
      <Typography variant="small" type="secondary">
        {formatNumber(secondaryBalance)} {token}
      </Typography>
    );
  };

  return (
    <div className="col-flex">
      <div style={{ display: 'flex', alignItems: 'baseline', fontSize: 16 }}>
        <Typography
          variant="h5"
          weight={500}
          style={{ color: 'var(--sq-blue600)', marginRight: 8 }}
        >
          {formatNumber(mainBalance)}
        </Typography>
        {token}
      </div>
      {secondaryRender()}
    </div>
  );
};

const ProjectDetailsView: FC<Props> = ({ project }) => {
  // const { description, websiteUrl, codeUrl } = project.details;
  const websiteUrl = new Array(100).fill('https://www.baidu.com').join('');
  const codeUrl = new Array(100).fill('https://www.baidu.com').join('');
  const description = new Array(100).fill('https://www.baidu.com').join('');

  const [getManifest, manifest] = useLazyQuery<ManiFest>(GET_MANIFEST);

  const projectRewardsDetails = useQuery<GetProjectRewardsDetails>(GET_PROJECT_REWARDS_DETAILS, {
    variables: {
      id: project.id,
    },
  });

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {websiteUrl && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                color: 'var(--sq-blue600)',
                gap: 8,
              }}
            >
              <GlobalOutlined />
              <Typography variant="medium" className="overflowEllipsis" style={{ maxWidth: 500 }}>
                {websiteUrl}
              </Typography>
            </div>
          )}
          {codeUrl && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                color: 'var(--sq-blue600)',
                gap: 8,
              }}
            >
              <GithubOutlined />
              <Typography variant="medium" className="overflowEllipsis" style={{ maxWidth: 500 }}>
                {codeUrl}
              </Typography>
            </div>
          )}
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
        <div
          style={{ background: 'var(--sq-gray300)', height: 1, width: '100%', margin: '16px 0' }}
        />
        <Typography weight={600} variant="medium">
          Deployment Details
        </Typography>
        <LineBreak>
          <Markdown.Preview>{description}</Markdown.Preview>
        </LineBreak>
      </Left>
      <Right>
        <SubqlCard
          title="Totoal Rewards"
          titleExtra={BalanceLayout({
            mainBalance: formatSQT(
              projectRewardsDetails.data?.queryProjectDetailsFromNetwork.totalReward || '0'
            ),
          })}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="flex" style={{ justifyContent: 'space-between' }}>
              <Typography variant="small" type="secondary">
                {project.projectType === ProjectType.Rpc ? 'Total RPC Providers' : 'Total Indexers'}
              </Typography>
              <Typography variant="small">
                {projectRewardsDetails.data?.queryProjectDetailsFromNetwork.indexerCount || 0}
              </Typography>
            </div>
            <div className="flex" style={{ justifyContent: 'space-between' }}>
              <Typography variant="small" type="secondary">
                Total Agreements
              </Typography>
              <Typography variant="small">
                {projectRewardsDetails.data?.queryProjectDetailsFromNetwork.totalAgreement || 0}
              </Typography>
            </div>
            <div className="flex" style={{ justifyContent: 'space-between' }}>
              <Typography variant="small" type="secondary">
                Total Offers
              </Typography>
              <Typography variant="small">
                {projectRewardsDetails.data?.queryProjectDetailsFromNetwork.totalOffer || 0}
              </Typography>
            </div>
          </div>
        </SubqlCard>
      </Right>
    </Container>
  );
};

export default ProjectDetailsView;

const LineBreak = styled.div`
  word-break: break-all;
  overflow-wrap: anywhere;
`;

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
