// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { TableText, TableTitle, Tag } from '@subql/components';

// TODO: this can migrate to @subql/components -> table as utils
export function createTextColumn<T>(index: T, title: string, toolTip?: string) {
  return {
    dataIndex: index,
    title: <TableTitle tooltip={toolTip} title={title} />,
    render: (val: string) => <TableText>{val}</TableText>,
  };
}

export function createTagColumn<T>(index: T, title: string, toolTip?: string) {
  return {
    dataIndex: index,
    title: <TableTitle tooltip={toolTip} title={title} />,
    render: ({ state, text }: { state: 'error' | 'success' | 'info'; text: string }) => (
      <Tag state={state}>{text}</Tag>
    ),
  };
}
