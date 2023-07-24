// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import styled from 'styled-components';

export const Contrainer = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 1270px;
  padding: 30px 50px;
  overflow: auto;
`;

export const LeftContainer = styled.div`
  display: flex;
  align-items: center;
  min-width: 685px;
  margin-bottom: 30px;
`;

export const ContentContainer = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  margin-left: 40px;
`;

export const VersionContainer = styled.div`
  display: flex;
  justify-content: space-between;
  margin-top: 25px;
  height: 50px;
  width: 500px;
`;
