// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import * as React from 'react';
import { Typography } from '@subql/components';
import { Button } from 'antd';
import { tipsChainIds } from 'conf/rainbowConf';
import { useAccount, useNetwork, useSwitchNetwork } from 'wagmi';

import styles from './ChainStatus.module.css';

export const ChainStatus: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { isConnected } = useAccount();
  const { chain } = useNetwork();
  const { chains, switchNetwork } = useSwitchNetwork();

  if (isConnected && !tipsChainIds.includes(chain?.id || 0)) {
    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <Typography className={styles.title}>Unsupported network</Typography>
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

  return <>{children}</>;
};
