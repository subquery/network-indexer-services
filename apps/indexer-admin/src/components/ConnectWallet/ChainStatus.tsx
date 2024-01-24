// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import * as React from 'react';
import { Redirect, useLocation } from 'react-router';
import { Typography } from '@subql/components';
import { Button } from 'antd';
import { tipsChainIds } from 'conf/rainbowConf';
import { isUndefined } from 'lodash';
import { useAccount, useNetwork, useSwitchNetwork } from 'wagmi';

import { useCoordinatorIndexer } from 'containers/coordinatorIndexer';
import { useIsIndexer } from 'hooks/indexerHook';

import styles from './ChainStatus.module.css';

export const ChainStatus: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { isConnected } = useAccount();
  const { chain } = useNetwork();
  const { chains, switchNetwork } = useSwitchNetwork();
  const { address } = useAccount();
  const { indexer } = useCoordinatorIndexer();
  const isIndexer = useIsIndexer();
  const location = useLocation();

  if (isConnected && !tipsChainIds.includes(chain?.id || 0)) {
    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <Typography variant="h5" weight={600}>
            Unsupported network
          </Typography>
          <div className={styles.switchContainer}>
            <Typography className={styles.description}>
              Please switch to Base to use SubQuery Indexer Coordinator.
            </Typography>
            <Button
              onClick={() => {
                switchNetwork?.(chains[0].id);
              }}
              type="primary"
              size="large"
              shape="round"
            >
              Switch Network
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isConnected && indexer !== address && !isUndefined(indexer)) {
    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <Typography variant="h5" weight={600}>
            Incorrect Connected Account with Coordinator Service
          </Typography>
          <div className={styles.switchContainer}>
            <Typography className={styles.description}>
              Please switch the connected account to {indexer}.
            </Typography>
            <Button type="primary" size="large" shape="round">
              Switching the account to use the Admin App manually
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!isIndexer && location.pathname !== '/register') {
    return <Redirect to="/register" />;
  }

  return <>{children}</>;
};
