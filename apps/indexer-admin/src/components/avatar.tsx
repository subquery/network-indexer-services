// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { FC } from 'react';
import { toSvg } from 'jdenticon';

type Props = {
  size: number;
  address: string;
};

const Avatar: FC<Props> = ({ size, address }) => (
  <img src={`data:image/svg+xml;utf8,${encodeURIComponent(toSvg(address, size))}`} alt="" />
);

export default Avatar;
