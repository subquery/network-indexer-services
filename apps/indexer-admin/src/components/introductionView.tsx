// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { FC } from 'react';
import { Typography } from '@subql/components';
import { Button } from 'antd';
import styled from 'styled-components';

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
        <Typography
          variant="h4"
          style={{ fontFamily: 'var(--sq-font-family-header)' }}
          weight={500}
        >
          {title}
        </Typography>
        <Typography type="secondary" style={{ textAlign: 'center', marginTop: 16 }}>
          {desc}
          {link}
        </Typography>
      </TextContainer>
      <Button
        shape="round"
        type="primary"
        loading={loading}
        onClick={() => {
          onClick();
        }}
        size="large"
        style={{ marginTop: 32 }}
      >
        {buttonTitle}
      </Button>
    </Container>
  );
};

export default IntroductionView;
