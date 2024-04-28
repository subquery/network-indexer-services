// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { FC, useMemo } from 'react';
import { isEmpty } from 'lodash';
import styled from 'styled-components';

import { AccountButtonItem } from 'pages/account/types';

import Avatar from './avatar';
import { Button, ButtonContainer, Text } from './primary';

type Props = {
  title: string;
  desc: string;
  buttons: AccountButtonItem[];
  name?: string;
  account?: string;
};

const AccountCard: FC<Props> = ({ title, desc, buttons, name, account }) => {
  const renderButtons = useMemo(
    () =>
      buttons.map(({ title, type, loading, disabled, onClick }, id) => (
        <Button
          key={id}
          width={230}
          mb={20}
          title={title}
          loading={loading}
          disabled={disabled}
          onClick={() => onClick(type)}
        />
      )),
    [buttons]
  );

  return (
    <Container>
      <div>
        <HeaderContainer>
          <ContentContainer>
            <Text size={30} fw="bold" mr={20}>
              {title}
            </Text>
          </ContentContainer>
        </HeaderContainer>
        {account ? (
          <ContentContainer>
            <Avatar address={account ?? ''} size={100} />
            <DescContainer ml={20}>
              <Text className="overflowEllipsis2">{name}</Text>
              <Text mt={10}>{account}</Text>
              <Text mt={10}>{desc}</Text>
            </DescContainer>
          </ContentContainer>
        ) : (
          <DescContainer>
            <Text color="gray" size={15} mb={30}>
              {desc}
            </Text>
            {!isEmpty(buttons) && <ButtonContainer align="left">{renderButtons}</ButtonContainer>}
          </DescContainer>
        )}
      </div>
      {!!account && !isEmpty(buttons) && (
        <GroupButtonContainer>{renderButtons}</GroupButtonContainer>
      )}
    </Container>
  );
};

export default AccountCard;

// styles
const Container = styled.div`
  display: flex;
  justify-content: space-between;
  min-width: 1000px;
  min-height: 250px;
  width: 70%;
  border: thin solid;
  border-color: lightgray;
  border-radius: 15px;
  padding: 40px;
  margin-bottom: 30px;
  :hover {
    box-shadow: 0 4px 8px 0 rgba(0, 0, 0, 0.2), 0 6px 20px 0 rgba(0, 0, 0, 0.19);
  }
`;

const HeaderContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 30px;
`;

const ContentContainer = styled.div`
  display: flex;
  align-items: center;
`;

const DescContainer = styled.div<{ ml?: number }>`
  display: flex;
  width: 80%;
  flex-direction: column;
  margin-left: ${({ ml }) => ml ?? 0}px;
`;

const GroupButtonContainer = styled.div`
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
`;
