// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { ChannelStatus, FlexPlanStatus, Plan } from 'hooks/paygHook';
import { createTagColumn, createTextColumn } from 'utils/table';
import { TOKEN_SYMBOL } from 'utils/web3';

import prompts from '../prompts';

const { channels } = prompts.payg;

type TableKey = 'consumer' | 'price' | 'spent' | 'deposit' | 'expiration' | 'status';

export const planColumns = [
  createTextColumn<TableKey>('consumer', 'CONSUMER'),
  createTextColumn<TableKey>('price', 'PRICE', 'The price of this flex plan'),
  createTextColumn<TableKey>(
    'spent',
    'SPENT',
    'The total amount that the consumer has spent so far'
  ),
  createTextColumn<TableKey>('deposit', 'REMAINING DEPOSIT'),
  createTextColumn<TableKey>(
    'expiration',
    'EXPIRATION',
    'The Flex Plan will end on the expiry date'
  ),
  createTagColumn<TableKey>('status', 'STATUS'),
];

export function getTagState(tabItem: FlexPlanStatus) {
  switch (tabItem) {
    case FlexPlanStatus.ONGOING:
      return { state: 'success', text: 'Active' };
    default:
      return { state: 'info', text: 'Completed' };
  }
}

export function statusToTabItem(status: ChannelStatus): FlexPlanStatus {
  switch (status) {
    case ChannelStatus.OPEN:
      return FlexPlanStatus.ONGOING;
    default:
      return FlexPlanStatus.CLOSED;
  }
}

export function tabToStatus(tabItem: FlexPlanStatus): ChannelStatus {
  switch (tabItem) {
    case FlexPlanStatus.ONGOING:
    default:
      return ChannelStatus.FINALIZED;
  }
}

export function plansToDatasource(id: string, plans: Plan[] | undefined, tabItem: FlexPlanStatus) {
  if (!plans) return [];
  // TODO: update `price` from onchain data
  return plans.map((p) => ({
    consumer: p.consumer,
    price: `500 ${TOKEN_SYMBOL}`,
    spent: `${p.spent} ${TOKEN_SYMBOL}`,
    deposit: `${p.total - p.spent} ${TOKEN_SYMBOL}`,
    expiration: new Date(p.expiredAt).toLocaleDateString(),
    status: getTagState(tabItem),
    action: { status: p.status, id },
  }));
}

export const tabItems = [
  {
    // TODO: add icons
    label: channels.tabs.open,
  },
  {
    // TODO: add icons
    label: channels.tabs.closed,
  },
];
