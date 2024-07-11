// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { FC, useMemo } from 'react';
import { Typography } from '@subql/components';
import { Tooltip } from 'antd';
import dayjs from 'dayjs';
import { floor } from 'lodash';
import styled from 'styled-components';

import { IGetRequestHistory } from 'utils/queries';

interface IProps {
  header?: React.ReactNode;
  uptimeData: IGetRequestHistory['getIndexerServiceRequestHistory'];
}

enum UPTIME_STATUS {
  ONLINE,
  OFFLINE,
}

// Design:
//  there are three part:
//     header (will receive from props)
//     chart. render in component. {}[]

const getUptimeStatus = (
  uptime: IGetRequestHistory['getIndexerServiceRequestHistory'][number]
): UPTIME_STATUS => {
  if (uptime.day !== dayjs().format('YYYY-MM-DD')) {
    if (uptime.healthyRate < 98) {
      return UPTIME_STATUS.OFFLINE;
    }

    return UPTIME_STATUS.ONLINE;
  }

  return uptime.latestSuccess ? UPTIME_STATUS.ONLINE : UPTIME_STATUS.OFFLINE;
};

const filterTooltipMsg = (
  uptime: IGetRequestHistory['getIndexerServiceRequestHistory'][number]
) => {
  const status = getUptimeStatus(uptime);
  if (status === UPTIME_STATUS.ONLINE) return 'You are online';
  if (!uptime.healthyRate) return 'You were offline for this entire day';
  return `You were offline for ${100 - uptime.healthyRate}% of health checks during this day`;
};

const UptimeBar: FC<IProps> = (props) => {
  const { header, uptimeData } = props;
  const uptimeRate = useMemo(() => {
    if (!uptimeData.length) return 0;
    const total = uptimeData.reduce((previous, current) => previous + current.total, 0);
    const success = uptimeData.reduce((previous, current) => previous + current.success, 0);

    return floor(floor(success / total, 2) * 100, 2);
  }, [uptimeData]);

  const notEnoughUptimeChunks = useMemo(() => {
    const today = dayjs();
    const groupedUptimeLength = uptimeData.length;
    if (!groupedUptimeLength) {
      return {
        prefix: new Array(90).fill(0),
        suffix: [],
      };
    }

    const lastRecordDay = uptimeData.at(-1);
    const suffix = new Array(today.diff(dayjs(lastRecordDay?.day), 'day')).fill(0);
    const prefixLength = 90 - groupedUptimeLength - suffix.length;
    return {
      suffix,
      prefix: new Array(prefixLength < 0 ? 0 : prefixLength).fill(0),
    };
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
          width: uptimeData.length ? '1260px' : 'auto',
        }}
      >
        {uptimeData.length ? (
          <div
            style={{
              display: 'flex',
              margin: '16px 0',
            }}
          >
            {notEnoughUptimeChunks.prefix.map((_, index) => (
              <StatusLine key={index} bg="var(--sq-gray300)" />
            ))}
            {uptimeData.map((uptime, index) => {
              return (
                <Tooltip
                  key={index}
                  placement="bottom"
                  color="#fff"
                  title={
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <Typography variant="medium" weight={900}>
                        {dayjs(uptime.day).format('DD MMM YYYY')}
                      </Typography>
                      <Typography variant="medium" weight={900}>
                        {filterTooltipMsg(uptime)}
                      </Typography>
                      {getUptimeStatus(uptime) === UPTIME_STATUS.OFFLINE &&
                        uptime.latestErrorMsg && (
                          <Typography
                            variant="medium"
                            weight={900}
                            style={{ wordBreak: 'break-word' }}
                          >
                            {uptime.latestErrorMsg}
                          </Typography>
                        )}
                    </div>
                  }
                >
                  <StatusLine
                    bg={
                      getUptimeStatus(uptime) === UPTIME_STATUS.ONLINE
                        ? 'var(--sq-success)'
                        : 'var(--sq-warning)'
                    }
                  />
                </Tooltip>
              );
            })}
            {notEnoughUptimeChunks.suffix.map((_, index) => (
              <StatusLine key={index} bg="var(--sq-gray300)" />
            ))}
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
