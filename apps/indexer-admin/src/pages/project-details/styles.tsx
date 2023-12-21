// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import styled from 'styled-components';

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 1270px;
  padding: 0px 50px;
  padding-bottom: 50px;
  overflow: auto;
`;

export const ContentContainer = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  -ms-overflow-style: none; /* for Internet Explorer, Edge */
  scrollbar-width: none; /* for Firefox */
  overflow-y: scroll;
  ::-webkit-scrollbar {
    display: none; /* for Chrome, Safari, and Opera */
  }
`;

export const CardContainer = styled.div`
  display: flex;
  justify-content: space-between;
  min-width: 1280px;
  border-radius: 8px;
  margin-top: 32px;
  padding: 32px;
  border: 1px solid var(--sq-gray300);
  background-color: #fff;
`;

export const ActionContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin-right: 32px;
  width: 200px;
  flex-shrink: 0;
  gap: 15px;

  a {
    width: 100%;
  }
`;
