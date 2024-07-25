// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import React, { FC, useEffect, useState } from 'react';
import { useMutation, useQuery } from '@apollo/client';
import { openNotification, Spinner, Typography } from '@subql/components';
import { Button, Switch } from 'antd';

import { AllConfig, ConfigKey, GET_ALL_CONFIG, SET_CONFIG } from 'utils/queries';

const GlobalConfig: FC = () => {
  const [config, setConfig] = useState({
    autoReduceOverAllocation: false,
  });

  const configQueryData = useQuery<AllConfig>(GET_ALL_CONFIG);
  const [setConfigMutation] = useMutation(SET_CONFIG);

  useEffect(() => {
    if (configQueryData.data) {
      setConfig({
        autoReduceOverAllocation:
          configQueryData.data.allConfig.find(
            (i) => i.key === ConfigKey.AutoReduceAllocationEnabled
          )?.value === 'true',
      });
    }
  }, [configQueryData.data]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
        padding: '64px 78px',
        width: '100%',
      }}
    >
      <Typography variant="h4">Config</Typography>

      <div
        style={{
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          borderRadius: 8,
          border: '1px solid var(--sq-gray300)',
          background: '#fff',
          width: '100%',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="h6">Auto Reduce Over Allocation</Typography>
          {!configQueryData.previousData && configQueryData.loading ? (
            <Spinner />
          ) : (
            <Switch
              checked={config.autoReduceOverAllocation}
              onChange={async () => {
                await setConfigMutation({
                  variables: {
                    key: ConfigKey.AutoReduceAllocationEnabled,
                    value: config.autoReduceOverAllocation ? 'false' : 'true',
                  },
                });
                openNotification({
                  type: 'success',
                  title: `Auto Reduce Over Allocation ${
                    config.autoReduceOverAllocation ? 'Disabled' : 'Enabled'
                  }`,
                  duration: 3,
                });
                setConfig({
                  ...config,
                  autoReduceOverAllocation: !config.autoReduceOverAllocation,
                });
              }}
            />
          )}
        </div>
        <Typography variant="medium" type="secondary" style={{ maxWidth: 807 }}>
          By enabling the &quot;Auto Reduce Over Allocation&quot; feature, this will automatically
          detect when your allocation amount exceeds your available stake. This feature ensures that
          over-allocations are evenly reduced across all projects, helping to maintain balanced
          resource distribution. By doing so, it helps operators avoid 0 rewards or burned rewards.
        </Typography>

        <div>
          <Button type="primary" shape="round">
            <a
              href="https://app.subquery.network/indexer/my-projects"
              target="_blank"
              rel="noreferrer"
            >
              View Your Allocation On Explorer
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
};
export default GlobalConfig;
