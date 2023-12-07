// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { useMemo, useState } from 'react';
import { Button, SubqlTable, TableTitle, Tabs } from '@subql/components';
import { useMount } from 'ahooks';

import { Text } from 'components/primary';
import { ChannelStatus, FlexPlanStatus, usePAYGPlans } from 'hooks/paygHook';

import prompts from '../prompts';
import { planColumns, plansToDatasource, tabItems } from './paygDatasource';
import { PlansContainer } from './styles';

const { channels } = prompts.payg;

type Props = {
  deploymentId: string;
  onTerminate?: (id: string) => void;
};

export function PAYGPlan({ deploymentId, onTerminate }: Props) {
  const [tabItem, setTabItem] = useState<FlexPlanStatus>(FlexPlanStatus.ONGOING);
  const { plans, getPlans } = usePAYGPlans(deploymentId);
  const dataSource = useMemo(
    () => plansToDatasource(deploymentId, plans, tabItem),
    [deploymentId, plans, tabItem]
  );

  const onTabChange = (tabValue: FlexPlanStatus) => {
    setTabItem(tabValue);
    getPlans(deploymentId, tabValue);
  };

  const teminateBtn = ({ id }: { id: string; status: ChannelStatus }) => (
    <Button
      type="link"
      size="medium"
      colorScheme="standard"
      title="Edit"
      onClick={() => onTerminate && onTerminate(id)}
    />
  );

  const actionColumn = {
    dataIndex: 'action',
    title: <TableTitle title="ACTION" />,
    render: teminateBtn,
  };

  useMount(() => {
    getPlans(deploymentId, tabItem);
  });

  return (
    <PlansContainer>
      <Text mb={10} size={20}>
        {channels.title}
      </Text>
      <Tabs tabs={tabItems} onTabClick={onTabChange} />
      <SubqlTable columns={[...planColumns, actionColumn]} dataSource={dataSource} />
    </PlansContainer>
  );
}
