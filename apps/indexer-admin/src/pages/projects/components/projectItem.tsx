// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { FC, useMemo } from 'react';
import { IoWarning } from 'react-icons/io5';
import { useHistory } from 'react-router-dom';
import { formatUnits } from '@ethersproject/units';
import { Spinner, SubqlProgress, Tag, Typography } from '@subql/components';
import { indexingProgress } from '@subql/network-clients';
import { SQT_DECIMAL, STABLE_COIN_DECIMAL, STABLE_COIN_SYMBOLS } from '@subql/network-config';
import { formatSQT } from '@subql/react-hooks';
import { Tooltip } from 'antd';
import BigNumberJs from 'bignumber.js';
import { isNull, isUndefined } from 'lodash';

import Avatar from 'components/avatar';
import UnsafeWarn from 'components/UnsafeWarn';
import { useContractSDK } from 'containers/contractSdk';
import { useCoordinatorIndexer } from 'containers/coordinatorIndexer';
import { useDeploymentStatus, useIsOnline } from 'hooks/projectHook';
import { useGetIfUnsafeDeployment } from 'hooks/useGetIfUnsafeDeployment';
import {
  ProjectDetails,
  ProjectType,
  ServiceStatus,
  TQueryMetadata,
} from 'pages/project-details/types';
import { cidToBytes32 } from 'utils/ipfs';
import { formatValueToFixed } from 'utils/units';
import { SUPPORTED_NETWORK, TOKEN_SYMBOL } from 'utils/web3';

import { OnlineStatus, statusText } from '../constant';
import { ItemContainer, ProfileContainer, ProjectItemContainer } from '../styles';

type Props = Omit<ProjectDetails, 'metadata'> & {
  metadata?: TQueryMetadata;
  metadataLoading: boolean;
};

const ProjectItem: FC<Props> = (props) => {
  const { id, details, payg, metadata, projectType, metadataLoading, dominantPrice } = props;
  const sdk = useContractSDK();
  const { indexer: account } = useCoordinatorIndexer();
  const history = useHistory();
  const { status } = useDeploymentStatus(id);
  const onlineStatus = useIsOnline({
    deploymentId: id,
    indexer: account || '',
  });
  const { isUnsafe } = useGetIfUnsafeDeployment(id);
  const progress = useMemo(() => {
    if (!metadata) return 0;

    const { targetHeight, lastHeight, startHeight = 0 } = metadata;

    return indexingProgress({
      startHeight: startHeight ?? 0,
      targetHeight,
      currentHeight: lastHeight,
    });
  }, [metadata]);

  const onlineStatusRender = useMemo(() => {
    if (isNull(onlineStatus)) return <Spinner />;
    if (isUndefined(onlineStatus)) return <Tag>Not Run</Tag>;
    return (
      <Tag
        color={onlineStatus ? 'success' : 'error'}
        style={{ height: '22px', lineHeight: '18px' }}
      >
        {onlineStatus ? OnlineStatus.online : OnlineStatus.offline}
      </Tag>
    );
  }, [onlineStatus]);

  const pushDetailPage = () => history.push(`/project/${id}`, { data: { ...props, status } });
  console.warn(
    dominantPrice.price,
    payg.price,
    BigNumberJs(formatSQT(BigNumberJs(dominantPrice.price || 1).toString())).lt(
      formatSQT(payg.price)
    )
  );
  return (
    <ProjectItemContainer onClick={pushDetailPage}>
      <ItemContainer flex={13}>
        <Avatar address={cidToBytes32(id)} size={40} />
        <ProfileContainer>
          <Typography className="overflowEllipsis2" style={{ gap: 8, maxWidth: 560 }}>
            {details.name}
            {isUnsafe && <UnsafeWarn />}
          </Typography>
          <Typography
            style={{ width: '100%', marginTop: 8, overflowWrap: 'anywhere' }}
            type="secondary"
            variant="small"
          >
            <span style={{ overflowWrap: 'anywhere' }}>{id}</span>
          </Typography>
        </ProfileContainer>
      </ItemContainer>

      <ItemContainer flex={4}>
        <Typography variant="small" type="secondary">
          {
            {
              [ProjectType.SubGraph]: 'SUBGRAPH',
              [ProjectType.SubQuery]: 'DATA INDEXER',
              [ProjectType.Rpc]: 'RPC ENDPOINT',
              [ProjectType.Dictionary]: 'DICTIONARY',
            }[projectType]
          }
        </Typography>
      </ItemContainer>
      <ItemContainer flex={4}>
        {metadataLoading ? (
          <Spinner />
        ) : (
          <SubqlProgress percent={formatValueToFixed(progress * 100)} />
        )}
      </ItemContainer>
      <ItemContainer flex={1} />
      <ItemContainer flex={3}>{onlineStatusRender}</ItemContainer>
      <ItemContainer flex={1} />
      <ItemContainer flex={1}>
        {payg?.expiration ? (
          <Typography variant="small" type="secondary" style={{ display: 'flex' }}>
            {BigNumberJs(
              formatUnits(
                payg?.price,
                payg.token === sdk?.sqToken.address || !payg.token
                  ? SQT_DECIMAL
                  : STABLE_COIN_DECIMAL[SUPPORTED_NETWORK]
              )
            )
              .multipliedBy(1000)
              .toFixed()}{' '}
            {payg.token === sdk?.sqToken.address || !payg.token
              ? TOKEN_SYMBOL
              : STABLE_COIN_SYMBOLS[SUPPORTED_NETWORK]}{' '}
            / 1000 requests
            {payg.error ? (
              <Tooltip title={`Convert price error, information: ${payg.error}`}>
                <IoWarning style={{ color: 'var(--sq-warning)', fontSize: 16, flexShrink: 0 }} />
              </Tooltip>
            ) : (
              ''
            )}
            {dominantPrice.lastError ? (
              <Tooltip
                title={`Fetch dominant price failed, the minimum acceptable price is used as the price for the flex plan. Error: ${dominantPrice.lastError}`}
              >
                <IoWarning style={{ color: 'var(--sq-warning)', fontSize: 16, flexShrink: 0 }} />
              </Tooltip>
            ) : (
              ''
            )}
            {dominantPrice.price &&
            BigNumberJs(formatSQT(BigNumberJs(dominantPrice.price || 1).toString())).lt(
              formatSQT(payg.price)
            ) ? (
              <Tooltip title="The minimum pricing greater than the dominant price, you will not receive any flex plan, consider reduce the minimum pricing.">
                <IoWarning style={{ color: 'var(--sq-warning)', fontSize: 16, flexShrink: 0 }} />
              </Tooltip>
            ) : (
              ''
            )}
          </Typography>
        ) : (
          <Typography variant="small" type="secondary">
            Not Available
          </Typography>
        )}
      </ItemContainer>
      <ItemContainer flex={1} />
      <ItemContainer flex={3}>
        {!isUndefined(status) ? (
          <Tag color={status === ServiceStatus.READY ? 'success' : 'default'}>
            {statusText[status]}
          </Tag>
        ) : (
          <Spinner />
        )}
      </ItemContainer>
    </ProjectItemContainer>
  );
};

export default ProjectItem;
