// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { formatUnits } from '@ethersproject/units';
import { BigNumberish } from 'ethers';

export function formatValue(value: BigNumberish) {
  return Number(formatUnits(value, 18)).toFixed(2);
}
