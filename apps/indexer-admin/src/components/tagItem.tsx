// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import React, { FC, useMemo } from 'react';
import { isNumber, isString } from 'lodash';
import styled from 'styled-components';

import { Text } from './primary';

const VersionItemContainer = styled.div<{ horizontal: boolean }>`
  display: flex;
  flex-direction: ${({ horizontal }) => (horizontal ? 'row' : 'column')};
  justify-content: ${({ horizontal }) => (horizontal ? 'center' : 'space-around')};
  align-items: ${({ horizontal }) => (horizontal ? 'center' : 'flex-start')};
  height: 100%;
`;

type VersionProps = {
  versionType: string;
  horizontal?: boolean;
  value?: React.ReactNode;
  prefix?: string;
  children?: React.ReactNode;
  fw?: number | 'normal' | 'bold';
};

export const TagItem: FC<VersionProps> = ({
  versionType,
  horizontal = false,
  value = '',
  prefix = '',
  children,
  fw = 400,
}) => {
  const mainColor = useMemo(() => (horizontal ? 'gray' : 'var(--sq-gray600)'), [horizontal]);
  const subColor = useMemo(() => (prefix ? '#4388dd' : 'var(--sq-gray900)'), [prefix]);

  const mainVal = useMemo(() => {
    if (horizontal) {
      return isString(value) || isNumber(value) ? (
        <Text ml={15} mr={15} color={subColor} fw={fw} size={14}>
          {children || `${prefix}${value}`}
        </Text>
      ) : (
        value
      );
    }

    if (isString(value) || isNumber(value))
      return (
        <Text mt={5} color={subColor} fw={fw} size={13}>
          {children || `${prefix}${value}`}
        </Text>
      );

    return value;
  }, [children, value, prefix, horizontal, fw, subColor]);

  return (
    <VersionItemContainer horizontal={horizontal}>
      <Text color={mainColor} size={14} fw={fw}>
        {versionType}
      </Text>
      {mainVal}
    </VersionItemContainer>
  );
};
