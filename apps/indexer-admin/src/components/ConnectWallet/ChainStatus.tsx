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
  const { chains, switchNetworkAsync } = useSwitchNetwork();

  if (isConnected && !tipsChainIds.includes(chain?.id || 0)) {
    return (
      <div className={styles.container}>
        <div className={styles.content}>
          <img src="/static/switch-network.png" alt="" width="80" height="80" />
          <Typography variant="h4">Switch to Base network</Typography>
          <Typography style={{ textAlign: 'center' }}>
            You need to be connected to the Base network to perform this action
          </Typography>
          <Button
            style={{ width: '100%' }}
            onClick={async () => {
              await switchNetworkAsync?.(chains[0].id);
            }}
            type="primary"
            size="large"
            shape="round"
          >
            Switch Network
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
