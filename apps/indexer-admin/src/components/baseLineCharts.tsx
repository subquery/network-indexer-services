// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import React, { FC } from 'react';
import { LineChart } from 'echarts/charts';
import { GridComponent, TitleComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';
import ReactEChartsCore from 'echarts-for-react/lib/core';

echarts.use([LineChart, GridComponent, TitleComponent, TooltipComponent, SVGRenderer]);

const BaseLineCharts: FC<{
  xAxis: string[];
  seriesData: (string | number)[];
  onTriggerTooltip?: (index: number) => string;
}> = ({ xAxis, seriesData, onTriggerTooltip }) => {
  return (
    <div>
      <ReactEChartsCore
        echarts={echarts}
        option={{
          grid: {
            left: 50,
            right: 20,
            top: 50,
          },
          xAxis: {
            axisLabel: {
              align: 'right',
            },
            axisLine: {
              show: false,
            },
            axisTick: {
              show: false,
            },
            type: 'category',
            boundaryGap: false,
            data: xAxis,
          },
          yAxis: {
            type: 'value',
          },
          series: [
            {
              data: seriesData,
              type: 'line',
              color: '#4388DD',
            },
          ],
          tooltip: {
            trigger: 'axis',
            borderWidth: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            textStyle: {
              color: '#fff',
            },
            className: 'lineChartToolTip',
            formatter: (params: [{ dataIndex: number }]) => {
              const [x] = params;
              try {
                const renderString = onTriggerTooltip?.(x.dataIndex);
                return renderString;
              } catch (e) {
                return '';
              }
            },
          },
        }}
        notMerge
        lazyUpdate
      />
    </div>
  );
};

export default BaseLineCharts;
