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
import { useHasController } from 'hooks/useHasController';

import styles from './ChainStatus.module.css';

export const ChainStatus: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { isConnected } = useAccount();
  const { chain } = useNetwork();
  const { chains, switchNetwork } = useSwitchNetwork();
  const { indexer } = useCoordinatorIndexer();
  const location = useLocation();

  const hasController = useHasController();

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

  // User have register in the coordinator service, but don't set the controller account
  if (
    isConnected &&
    !hasController &&
    // must have record, otherwises should redirect to register page.
    !isUndefined(indexer) &&
    location.pathname !== '/controller-management'
  ) {
    return <Redirect to="/controller-management" />;
  }

  // database don't have indexer record so must register.
  if (!indexer && location.pathname !== '/register') {
    return <Redirect to="/register" />;
  }

  return <>{children}</>;
};
