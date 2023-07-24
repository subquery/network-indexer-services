// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import styled from 'styled-components';

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  background-color: var(--sq-primary-blue);
  min-height: 150px;
  width: 100%;
`;

export const ContentContainer = styled.div`
  display: flex;
  justify-content: space-between;
  border-bottom: solid 1px white;
  padding-left: 80px;
  padding-right: 100px;
  align-items: center;
  min-height: 120px;
  width: 100%;
`;

export const IconsContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-around;
  min-width: 550px;
  height: 100%;
`;
