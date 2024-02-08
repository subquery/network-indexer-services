// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { FC } from 'react';
import { Spinner } from '@subql/components';
import styled from 'styled-components';

import { useLoading } from 'containers/loadingContext';

const Container = styled.div`
  position: absolute;
  display: flex;
  width: 100%;
  height: 100%;
  z-index: 1000;
  background-color: white;
  justify-content: center;
  align-items: flex-start;
`;

const Loading: FC = () => {
  const { pageLoading } = useLoading();
  if (!pageLoading) return null;
  return (
    <Container>
      <Spinner size={30} />
    </Container>
  );
};

export const LoadingSpinner = () => (
  <Container>
    <Spinner size={30} />
  </Container>
);

export default Loading;
