// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import styled from 'styled-components';

// controller management page
export const Container = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 600px;
  padding: 30px 100px;
  padding-bottom: 80px;
  overflow-y: scroll;
  min-width: 1200px;
`;

export const HeaderContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

export const ContentContainer = styled.div<{ mt?: number }>`
  display: flex;
  flex-direction: column;
  margin-top: ${({ mt }) => mt ?? 0}px;
`;

export const IntroContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: flex-start;
  margin-top: 80px;
`;

// controller items styles
export const ItemContainer = styled.div`
  display: flex;
  flex: 1;
  width: 100%;
  min-width: 600px;
  min-height: 90px;
  margin: 10px 0px;
  padding: 10px 20px;
  border-color: gray;
  border-radius: 10px;
  background-color: white;
  align-items: center;
  :hover {
    box-shadow: 0 4px 8px 0 rgba(0, 0, 0, 0.2), 0 6px 20px 0 rgba(0, 0, 0, 0.19);
    cursor: pointer;
  }
`;

export const ItemContentContainer = styled.div`
  display: flex;
  flex: 6;
  align-items: center;
`;

export const AccountContainer = styled.div`
  display: flex;
  flex: 4;
  flex-direction: column;
  margin: 0px 20px;
`;

export const Balance = styled.div`
  display: flex;
  flex: 2;
`;

export const Status = styled.div`
  display: flex;
  flex: 2;
  align-items: center;
`;

export const Buttons = styled.div`
  display: flex;
  flex: 2;
  justify-content: flex-end;
  min-width: 300px;
`;
