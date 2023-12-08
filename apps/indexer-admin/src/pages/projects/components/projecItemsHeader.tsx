// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Typography } from '@subql/components';
import styled from 'styled-components';

import { ItemContainer } from '../styles';

const Container = styled.div`
  display: flex;
  width: 100%;
  min-width: 600px;
  height: 60px;
  margin-top: 32px;
  margin-bottom: 16px;
  padding: 0 16px;
`;

const projetHeaderItems = [
  { title: 'Project Name', flex: 12 },
  { title: 'Progress', flex: 5 },
  { title: 'Type', flex: 3 },
  { title: 'Status', flex: 3 },
];

const ProjecItemsHeader = () => (
  <Container>
    {projetHeaderItems.map(({ title, flex }) => (
      <ItemContainer key={title} flex={flex}>
        <Typography
          variant="small"
          weight={600}
          type="secondary"
          style={{ textTransform: 'uppercase' }}
        >
          {title}
        </Typography>
      </ItemContainer>
    ))}
  </Container>
);

export default ProjecItemsHeader;
