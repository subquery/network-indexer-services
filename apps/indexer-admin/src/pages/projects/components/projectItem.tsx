// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { FC, useMemo } from 'react';
import { useHistory } from 'react-router-dom';
import { Spinner, SubqlProgress, Tag, Typography } from '@subql/components';
import { indexingProgress } from '@subql/network-clients';
import { isUndefined } from 'lodash';

import Avatar from 'components/avatar';
import UnsafeWarn from 'components/UnsafeWarn';
import { useAccount } from 'containers/account';
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

import { OnlineStatus, statusText } from '../constant';
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

  const pushDetailPage = () => history.push(`/project/${id}`, { data: { ...props, status } });

  return (
    <ProjectItemContainer onClick={pushDetailPage}>
      <ItemContainer flex={13}>
        <Avatar address={cidToBytes32(id)} size={50} />
        <ProfileContainer>
          <Typography style={{ display: 'inline-flex', gap: 8 }}>
            {details.name}
            {isUnsafe && <UnsafeWarn />}
          </Typography>
          <Typography
            style={{ width: '100%', marginTop: 8, minWidth: 360 }}
            type="secondary"
            variant="small"
          >
            <span style={{ overflowWrap: 'anywhere' }}>{id}</span>
          </Typography>
        </ProfileContainer>
      </ItemContainer>

      <ItemContainer flex={5}>
        <Typography variant="small" type="secondary">
          {projectType === ProjectType.SubQuery ? 'DATA INDEXER' : 'RPC ENDPOINT'}
        </Typography>
      </ItemContainer>
      <ItemContainer flex={4}>
        <SubqlProgress percent={formatValueToFixed(progress * 100)} />
      </ItemContainer>
      <ItemContainer flex={1} />
      <ItemContainer flex={3}>
        <Tag
          color={onlineStatus ? 'success' : 'error'}
          style={{ height: '22px', lineHeight: '18px' }}
        >
          {onlineStatus ? OnlineStatus.online : OnlineStatus.offline}
        </Tag>
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
