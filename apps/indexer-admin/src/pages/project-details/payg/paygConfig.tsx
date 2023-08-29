// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Button, Table, TableTitle } from '@subql/components';

import { createTextColumn } from 'utils/table';
import { TOKEN_SYMBOL } from 'utils/web3';

type Props = {
  price: string;
  period: number;
  onEdit: () => void;
};

const columns = [
  createTextColumn('price', 'PRICE'),
  createTextColumn('period', 'MAXIMUM VALIDITY PERIOD'),
];

export function PAYGConfig({ price, period, onEdit }: Props) {
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
            price: `${price} ${TOKEN_SYMBOL} / 1000 requests`,
            period: `${period} days`,
          },
        ],
      }}
    />
  );
}
