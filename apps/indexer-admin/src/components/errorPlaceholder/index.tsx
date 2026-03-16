// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import React, { FC } from 'react';
import { Typography } from '@subql/components';

interface IProps {
  size?: 'normal' | 'small';
}

const ErrorPlaceholder: FC<IProps> = (props) => {
  const { size = 'normal' } = props;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        rowGap: 8,
      }}
    >
      <img
        src="/images/error.svg"
        alt="rpc"
        style={{
          width: 96,
          height: 74,
        }}
      />
      <Typography variant={size === 'small' ? 'h6' : 'h5'} weight={500}>
        Oops! Can&apos;t connect to coordinator
      </Typography>
      <Typography type="secondary" style={{ textAlign: 'center' }}>
        It looks like the coordinator service is temporarily unavailable
        <span>, please</span>
        <br />
        <span>check your coordinator service or let us know in </span>
        <a href="https://discord.com/invite/subquery">
          <span
            style={{
              textDecoration: 'underline',
              cursor: 'pointer',
              color: 'var(--sq-gray600)',
            }}
          >
            Discord.
          </span>
        </a>
      </Typography>
    </div>
  );
};
export default ErrorPlaceholder;
