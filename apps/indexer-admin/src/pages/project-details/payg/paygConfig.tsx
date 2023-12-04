// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Button, SubqlTable, TableTitle } from '@subql/components';

import { createTextColumn } from 'utils/table';

type Props = {
  priceData: React.ReactNode;
  period: number;
  onEdit: () => void;
};

const columns = [
  createTextColumn('price', 'PRICE'),
  createTextColumn('period', 'MAXIMUM VALIDITY PERIOD'),
];

export function PAYGConfig({ priceData, period, onEdit }: Props) {
  const actionColumn = {
    dataIndex: 'action',
    title: <TableTitle title="ACTION" />,
    render: () => (
      <Button type="link" size="medium" colorScheme="standard" label="Edit" onClick={onEdit} />
    ),
  };

  return (
    <SubqlTable
      pagination={false}
      columns={[...columns, actionColumn]}
      dataSource={[
        {
          price: priceData,
          period: `${period} days`,
        },
      ]}
    />
  );
}
