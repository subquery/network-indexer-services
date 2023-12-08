// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { FC, useMemo } from 'react';
import { useHistory } from 'react-router-dom';
import { Spinner, Tag, Typography } from '@subql/components';
import { indexingProgress } from '@subql/network-clients';
import { Progress } from 'antd';
import { isUndefined } from 'lodash';

import Avatar from 'components/avatar';
import { useAccount } from 'containers/account';
import { useDeploymentStatus, useIsOnline } from 'hooks/projectHook';
import {
  ProjectDetails,
  ProjectType,
  ServiceStatus,
  TQueryMetadata,
} from 'pages/project-details/types';
import { cidToBytes32 } from 'utils/ipfs';
import { formatValueToFixed } from 'utils/units';

import { statusText } from '../constant';
import { ItemContainer, ProfileContainer, ProjectItemContainer } from '../styles';

type Props = Omit<ProjectDetails, 'metadata'> & {
  metadata?: TQueryMetadata;
};

const ProjectItem: FC<Props> = (props) => {
  const { id, details, metadata, projectType } = props;

  const { account } = useAccount();
  const history = useHistory();
  const status = useDeploymentStatus(id);
  const onlineStatus = useIsOnline({
    deploymentId: id,
    indexer: account || '',
  });
  const progress = useMemo(() => {
    if (!metadata) return 0;

    const { targetHeight, lastHeight, startHeight = 0 } = metadata;

    return indexingProgress({
      startHeight: startHeight ?? 0,
      targetHeight,
      currentHeight: lastHeight,
    });
  }, [metadata]);

  const pushDetailPage = () => history.push(`/project/${id}`, { data: { ...props, status } });

  return (
    <ProjectItemContainer onClick={pushDetailPage}>
      <ItemContainer flex={12}>
        <Avatar address={cidToBytes32(id)} size={50} />
        <ProfileContainer>
          <Typography>{details.name}</Typography>
          <Typography style={{ width: '100%', marginTop: 8, minWidth: 500 }} type="secondary">
            <span>Deployment ID:</span>
            <span style={{ overflowWrap: 'anywhere' }}>{id}</span>
          </Typography>
        </ProfileContainer>
      </ItemContainer>
      <ItemContainer flex={5}>
        <Progress percent={formatValueToFixed(progress * 100)} />
      </ItemContainer>
      {/* <ItemContainer flex={5}>
        <Tag
          state={onlineStatus ? 'success' : 'error'}
          style={{ height: '22px', lineHeight: '18px' }}
        >
          {onlineStatus ? OnlineStatus.online : OnlineStatus.offline}
        </Tag>
      </ItemContainer> */}
      <ItemContainer flex={3}>
        <Typography variant="medium">
          {projectType === ProjectType.SubQuery ? 'SubQuery Project' : 'RPC Service'}
        </Typography>
      </ItemContainer>
      <ItemContainer flex={3}>
        {!isUndefined(status) ? (
          // <StatusLabel text={statusText[status]} color={statusColor[status]} />
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
