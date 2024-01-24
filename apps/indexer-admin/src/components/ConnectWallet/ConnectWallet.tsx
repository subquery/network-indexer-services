// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import * as React from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Typography } from '@subql/components';
import { Button } from 'antd';
import clsx from 'clsx';

import styles from './ConnectWallet.module.css';

type Props = {
  title?: string;
  subTitle?: string;
  className?: string;
};

export const ConnectWallet: React.FC<Props> = ({ title, subTitle, className }) => {
  return (
    <div className={clsx(styles.container, className)}>
      <img
        src="/static/connectWallet.png"
        alt="connect wallet"
        width="238"
        height="238"
        style={{ objectFit: 'contain' }}
      />
      <Typography variant="h4" className={styles.title} weight={600}>
        {title || 'Connect your wallet'}
      </Typography>
      <Typography
        variant="text"
        style={{ color: 'var(--gray700)', margin: '1rem 0', textAlign: 'center' }}
      >
        {subTitle ||
          "To continue, please connect your wallet to the SubQuery Network. If you don't have a wallet, you can select a provider and create one now."}
      </Typography>

      <ConnectButton.Custom>
        {({ openConnectModal }) => (
          <Button
            shape="round"
            size="large"
            onClick={() => openConnectModal()}
            type="primary"
            style={{ width: '100%', background: 'var(--sq-blue600)' }}
            className={styles.connectBtn}
          >
            Connect Wallet
          </Button>
        )}
      </ConnectButton.Custom>
    </div>
  );
};
