// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { useMemo } from 'react';
import { isUndefined } from 'lodash';

import Avatar from 'components/avatar';
import { LoadingSpinner } from 'components/loading';
import { Separator, Text } from 'components/primary';
import { TagItem } from 'components/tagItem';
import { useAccount } from 'containers/account';
import { useIndexerMetadata } from 'hooks/indexerHook';
import { useIndexerEra } from 'hooks/network';

import NetworkTabbarView from './components/networkTabBarView';
import { ContentContainer, Contrainer, LeftContainer, VersionContainer } from './styles';

const NetworkPage = () => {
  const { account } = useAccount();
  const { metadata } = useIndexerMetadata();
  const indexerEra = useIndexerEra();

  const eraItems = useMemo(
    () => (
      <VersionContainer>
        <TagItem versionType="CURRENT ERA" prefix="#" value={indexerEra?.currentEra} />
        <Separator height={50} />
        <TagItem versionType="LAST CLAIM ERA" prefix="#" value={indexerEra?.lastClaimedEra} />
        <Separator height={50} />
        <TagItem versionType="LAST SETTLE ERA" prefix="#" value={indexerEra?.lastSettledEra} />
      </VersionContainer>
    ),
    [indexerEra]
  );

  if (isUndefined(indexerEra)) return <LoadingSpinner />;

  return (
    <Contrainer>
      <LeftContainer>
        <Avatar address={account ?? ''} size={100} />
        <ContentContainer>
          <Text fw="600" size={30}>
            {metadata?.name}
          </Text>
          <Text fw="400" size={15}>
            {account}
          </Text>
          {eraItems}
        </ContentContainer>
      </LeftContainer>
      <NetworkTabbarView />
    </Contrainer>
  );
};

export default NetworkPage;
