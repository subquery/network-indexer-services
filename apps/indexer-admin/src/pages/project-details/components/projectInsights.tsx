// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable camelcase */

import React, { FC, useMemo, useState } from 'react';
import { Typography } from '@subql/components';
import { useMount } from 'ahooks';
import axios from 'axios';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

import BaseLineCharts from 'components/baseLineCharts';
import { coordinatorServiceUrl } from 'utils/apolloClient';

dayjs.extend(utc);

interface IProps {
  id: string;
}

interface StatisticRes {
  id: number;
  ca_http: number;
  ca_p2p: number;
  data_time: Date;
  deployment_cid: string;
  failure: number;
  free_http: number;
  free_p2p: number;
  payg_http: number;
  payg_p2p: number;
}

const ProjectInsights: FC<IProps> = (props) => {
  const { id } = props;
  const [insightData, setInsightData] = useState<StatisticRes[]>([]);
  const getInsightData = async () => {
    const res = await axios.get<StatisticRes[]>(
      `${coordinatorServiceUrl.replace('/graphql', '')}/stats/${id}/${dayjs
        .utc()
        .subtract(1, 'day')
        .format()}/${dayjs.utc().format()}`
    );

    if (res.status === 200) {
      setInsightData(res.data);
    }
  };

  const xAxis = useMemo(() => {
    const now = dayjs.utc();
    return new Array(24)
      .fill(0)
      .map((_, index) => {
        const timeDayjs = now.subtract(index, 'hours');
        return {
          displayTime: timeDayjs.format('HH:00'),
          time: timeDayjs,
        };
      })
      .reverse();
  }, []);

  const seriesData = useMemo(() => {
    return xAxis.map((curData) => {
      const find = insightData.find(
        (i) => dayjs.utc(i.data_time).format('HH:00') === curData.displayTime
      );

      if (find) {
        return [
          find.ca_http,
          find.ca_p2p,
          find.free_http,
          find.free_p2p,
          find.payg_http,
          find.payg_p2p,
        ].reduce((cur, add) => cur + add, 0);
      }

      return 0;
    });
  }, [xAxis, insightData]);

  useMount(() => {
    getInsightData();
  });

  return (
    <div style={{ padding: '0 6px', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h5">Project Insights</Typography>
      <Typography style={{ marginTop: 8, marginBottom: 24 }}>
        More insights and analytics from your project can be found via Grafana monitoring,{' '}
        <a
          href="https://academy.subquery.network/run_publish/monitor.html"
          style={{ color: 'var(--sq-blue600)' }}
        >
          find out how
        </a>
      </Typography>
      <div
        style={{
          padding: 24,
          border: '1px solid rgba(223, 227, 232, 0.60)',
          background: '#fff',
          borderRadius: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <Typography>Requests</Typography>
          <Typography type="secondary" variant="small">
            (UTC)
          </Typography>
        </div>
        <BaseLineCharts
          xAxis={xAxis.map((i) => i.displayTime)}
          seriesData={seriesData}
          onTriggerTooltip={(index) => {
            return `
            <div style="width: 280px; display: flex; flex-direction: column; gap: 8px;">
              <div>Requests Summary</div>
              <div style="display:flex; justify-content:space-between;">
                <span>Totoal Requests</span>
                <span>${seriesData[index].toLocaleString()}</span>
              </div>
              <div style="color: #DFE3E8">${xAxis[index].time.format('MMM D, YYYY')}</div>
            </div>
          `;
          }}
        />
      </div>
    </div>
  );
};
export default ProjectInsights;
