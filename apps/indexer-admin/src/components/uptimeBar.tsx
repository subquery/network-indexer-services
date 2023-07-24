// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { FC, useMemo } from 'react';
import { Typography } from '@subql/components';
import { Tooltip } from 'antd';
import dayjs from 'dayjs';
import { floor, groupBy } from 'lodash';
import styled from 'styled-components';

import { IGetRequeestHistory } from 'utils/queries';

interface IProps {
  header?: React.ReactNode;
  uptimeData: IGetRequeestHistory['getRequestHistory']['records'];
}

// Design:
//  there are three part:
//     header (will receive from props)
//     chart. render in component. {}[]

type groupByUptime = IGetRequeestHistory['getRequestHistory']['records'][number] & {
  healthyRate: number;
};

const filterTooltipMsg = (uptime: groupByUptime) => {
  if (uptime.nodeSuccess) return 'You are online';
  if (uptime.healthyRate)
    return `You were offline for ${uptime.healthyRate} %of health checks during this day`;

  return 'You were offline for this entire day';
};

const UptimeBar: FC<IProps> = (props) => {
  const { header, uptimeData } = props;

  const uptimeRate = useMemo(() => {
    if (!uptimeData.length) return 0;
    const online = uptimeData.filter((i) => i.nodeSuccess);

    return floor(online.length / uptimeData.length, 2);
  }, [uptimeData]);

  // TODO: maybe need backend group by.
  const groypByUptime = useMemo(() => {
    // need to group by date
    const newUptimeData: groupByUptime[] = [];
    const groupByDate = groupBy(uptimeData, (i) => dayjs(i.timestamp).format('YYYY-MM-DD'));
    Object.keys(groupByDate).forEach((key) => {
      const latest = groupByDate[key]
        .sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp))
        .at(-1);
      if (!latest) return;
      // get the haalthyRate
      const healthyCount = groupByDate[key].filter((i) => i.nodeSuccess);

      newUptimeData.push({
        ...latest,
        healthyRate: Math.ceil((healthyCount.length / groupByDate[key].length) * 100),
      });
    });

    return newUptimeData.slice(0, 90).reverse();
  }, [uptimeData]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '32px',
        background: '#fff',
        border: '1px solid #DFE3E8',
        overflow: 'auto',
      }}
    >
      {header}

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: groypByUptime.length ? '1260px' : 'auto',
        }}
      >
        {groypByUptime.length ? (
          <div
            style={{
              display: 'flex',
              margin: '16px 0',
            }}
          >
            {new Array(90 - groypByUptime.length).fill(0).map((_, index) => (
              <StatusLine key={index} bg="var(--sq-gray300)" />
            ))}
            {groypByUptime.map((uptime, index) => {
              return (
                <Tooltip
                  key={index}
                  placement="bottom"
                  color="#fff"
                  title={
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <Typography variant="medium" weight={900}>
                        {dayjs(uptime.timestamp).format('DD MMM YYYY')}
                      </Typography>
                      <Typography variant="medium" weight={900}>
                        {filterTooltipMsg(uptime)}
                      </Typography>
                      {!uptime.nodeSuccess && uptime.errorMsg && (
                        <Typography variant="medium" weight={900}>
                          {uptime.errorMsg}
                        </Typography>
                      )}
                    </div>
                  }
                >
                  <StatusLine bg={uptime.nodeSuccess ? 'var(--sq-success)' : 'var(--sq-warning)'} />
                </Tooltip>
              );
            })}
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '32px',
            }}
          >
            <Typography variant="small" type="neutral">
              There is no uptime data yet
            </Typography>
          </div>
        )}
        <div
          style={{
            position: 'relative',
            height: '1px',
            width: '100%',
            background: 'var(--sq-gray300)',
            marginTop: '9px',
          }}
        >
          <AbsoluteDiv style={{ left: 0, paddingLeft: 0 }}>90 days ago</AbsoluteDiv>
          <AbsoluteDiv style={{ left: '50%', transform: 'translateX(-50%)' }}>
            {uptimeRate}% uptime
          </AbsoluteDiv>
          <AbsoluteDiv style={{ right: 0, paddingRight: 0 }}>Today</AbsoluteDiv>
        </div>
      </div>
    </div>
  );
};

const AbsoluteDiv = styled.div`
  position: absolute;
  color: var(--sq-gray500);
  top: -9px;
  background: #fff;
  padding: 0 12px;
`;

const StatusLine = styled.div<{ bg: string }>`
  background: ${({ bg }) => bg};
  height: 32px;
  width: 8px;
  min-width: 8px;
  flex-shrink: 0;
  border-radius: 2px;
  margin-right: 6px;
  cursor: pointer;
`;

export default UptimeBar;
