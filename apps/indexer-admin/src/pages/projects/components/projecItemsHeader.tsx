// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import styled from 'styled-components';

import { Text } from 'components/primary';

import { ItemContainer } from '../styles';

const Container = styled.div`
  display: flex;
  width: 100%;
  min-width: 600px;
  height: 60px;
  margin-top: 50px;
  margin-bottom: 30px;
`;

const projetHeaderItems = [
  { title: 'Project Name', flex: 7 },
  { title: 'Progress', flex: 8 },
  { title: 'Uptime', flex: 5 },
  { title: 'Type', flex: 3 },
  { title: 'Indexing Status', flex: 3 },
];

const ProjecItemsHeader = () => (
  <Container>
    {projetHeaderItems.map(({ title, flex }) => (
      <ItemContainer key={title} color="#f6f9fc" flex={flex}>
        <Text color="gray">{title}</Text>
      </ItemContainer>
    ))}
  </Container>
);

export default ProjecItemsHeader;
