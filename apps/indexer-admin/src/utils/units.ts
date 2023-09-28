// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { formatUnits } from '@ethersproject/units';
import { BigNumberish } from 'ethers';

export function formatValue(value: BigNumberish) {
  return Number(formatUnits(value, 18)).toFixed(2);
}

export function formatValueToFixed(val: number, fixed = 2) {
  return +val.toFixed(fixed);
}

export function truncFormatEtherStr(value: string, decimalPlaces = 4): string {
  const [wholeNumberStr, decimalPlacesStr] = value.split('.');
  if (!decimalPlacesStr) return wholeNumberStr;

  const subStrLength =
    decimalPlacesStr.length > decimalPlaces ? decimalPlaces : decimalPlacesStr.length;
  const sortedDecimalPlaceStr = decimalPlacesStr.substring(0, subStrLength);
  return wholeNumberStr.concat('.', sortedDecimalPlaceStr);
}
