// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Button, Table, TableTitle } from '@subql/components';

import { createTextColumn } from 'utils/table';
import { TOKEN_SYMBOL } from 'utils/web3';

type Props = {
  sqtPrice: string;
  usdcPrice: string;
  period: number;
  onEdit: () => void;
};

const columns = [
  createTextColumn('price', 'PRICE'),
  // createTextColumn('usdcPrice', 'To USDC Price'),
  createTextColumn('period', 'MAXIMUM VALIDITY PERIOD'),
];

export function PAYGConfig({ sqtPrice, usdcPrice, period, onEdit }: Props) {
  const actionColumn = {
    dataIndex: 'action',
    title: <TableTitle title="ACTION" />,
    render: () => (
      <Button type="link" size="medium" colorScheme="standard" label="Edit" onClick={onEdit} />
    ),
  };

  return (
    <Table
      tableProps={{
        pagination: false,
        columns: [...columns, actionColumn],
        dataSource: [
          {
            price: `${sqtPrice} ${TOKEN_SYMBOL} / 1000 requests`,
            usdcPrice: `${usdcPrice} USDC / 1000 requests`,
            period: `${period} days`,
          },
        ],
      }}
    />
  );
}
