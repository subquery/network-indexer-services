// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { ProgressBar } from '@subql/react-ui';
import styled from 'styled-components';

export const Container = styled.div`
  display: flex;
  flex: 1;
  justify-content: center;
`;

export const ContentContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  min-width: 600px;
  padding: 10px 100px;
  padding-bottom: 150px;
  overflow-y: scroll;
`;

export const HeaderContainer = styled.div`
  display: flex;
  width: 100%;
  min-width: 600px;
  align-items: center;
  justify-content: space-between;
`;

export const ItemContainer = styled.div<{
  flex?: number;
  pl?: number;
  mw?: number;
  color?: string;
}>`
  display: flex;
  flex: ${({ flex }) => flex ?? 1};
  background-color: ${({ color }) => color ?? 'white'};
  padding-left: ${({ pl }) => pl ?? 0}px;
  min-width: ${({ mw }) => mw ?? 100}px;
  margin-right: 15px;
  align-items: center;
`;

/// Project item styles
export const ProjectItemContainer = styled.div`
  display: flex;
  width: 100%;
  min-width: 600px;
  min-height: 90px;
  margin: 10px 0px;
  padding: 10px 10px;
  background-color: white;
  :hover {
    box-shadow: 0 4px 8px 0 rgba(0, 0, 0, 0.2), 0 6px 20px 0 rgba(0, 0, 0, 0.19);
    cursor: pointer;
  }
`;

export const Progress = styled(ProgressBar)`
  max-width: 60%;
  min-width: 300;
`;

export const ProfileContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 80%;
  margin-left: 20px;
`;
