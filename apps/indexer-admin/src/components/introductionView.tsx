// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { FC } from 'react';
import styled from 'styled-components';

import { Button, Text } from 'components/primary';

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  border-radius: 18px;
  margin-bottom: 50px;
  padding: 60px;
  min-width: 800px;
  max-width: 50%;
  min-height: 450px;
`;

export const TextContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

type Content = {
  title: string;
  desc: string;
  buttonTitle: string;
};

type Props = {
  item: Content;
  onClick: () => void;
  link?: JSX.Element;
  loading?: boolean;
};

const IntroductionView: FC<Props> = ({ item, onClick, loading, link }) => {
  const { title, desc, buttonTitle } = item;
  return (
    <Container>
      <TextContainer>
        <Text alignCenter size={35} fw="bold">
          {title}
        </Text>
        <Text alignCenter mt={35}>
          {desc}
          {link}
        </Text>
      </TextContainer>
      <Button mt={80} type="primary" title={buttonTitle} loading={loading} onClick={onClick} />
    </Container>
  );
};

export default IntroductionView;
