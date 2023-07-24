// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { FC, useState } from 'react';
import { useParams } from 'react-router';
import { NetworkStatus } from '@apollo/client';
import { Typography } from '@subql/components';
import { useMount } from 'ahooks';

import UptimeBar from 'components/uptimeBar';
import { useAccount } from 'containers/account';
import { getRequestHistory, IGetRequeestHistory } from 'utils/queries';

const ProjectUptime: FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const { account } = useAccount();
  const [history, setHistory] = useState<IGetRequeestHistory['getRequestHistory']['records']>([]);

  const getHistory = async (): Promise<void> => {
    if (!account) return;
    const res = await getRequestHistory({
      deploymentId: id,
      indexer: account,
    });

    if (res.status === NetworkStatus.ready) {
      setHistory(res.data.getRequestHistory.records);
    }
  };

  useMount(() => {
    getHistory();
  });

  if (!history.length) return <></>;

  return (
    <div style={{ marginTop: '23px' }}>
      <UptimeBar
        header={
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Typography variant="large" weight={600} style={{ marginRight: '16px' }}>
              Deployment Uptime
            </Typography>
          </div>
        }
        uptimeData={history}
      />
    </div>
  );
};
export default ProjectUptime;
