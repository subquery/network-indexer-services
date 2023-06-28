// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { FC } from 'react';
import Jazzicon, { jsNumberForAddress } from 'react-jazzicon';

type Props = {
  size: number;
  address: string;
};

const Avatar: FC<Props> = ({ size, address }) => (
  <Jazzicon diameter={size} seed={jsNumberForAddress(address)} />
);

export default Avatar;
