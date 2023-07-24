// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { FC } from 'react';
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
  value?: string | number;
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
  fw = 500,
}) => {
  const mainColor = horizontal ? 'gray' : 'black';
  const subColor = prefix ? '#4388dd' : 'gray';
  return (
    <VersionItemContainer horizontal={horizontal}>
      <Text color={mainColor} size={horizontal ? 13 : 15} fw={fw}>
        {versionType}
      </Text>
      {horizontal ? (
        <Text ml={15} mr={15} color={subColor} fw={fw} size={15}>
          {children || `${prefix}${value}`}
        </Text>
      ) : (
        <Text mt={5} color={subColor} fw={fw} size={13}>
          {children || `${prefix}${value}`}
        </Text>
      )}
    </VersionItemContainer>
  );
};
