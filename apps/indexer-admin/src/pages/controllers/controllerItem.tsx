// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { FC } from 'react';
import { Tag } from '@subql/components';
import { isUndefined } from 'lodash';

import { asyncRender } from 'components/asyncRender';
import Avatar from 'components/avatar';
import { Button, Text } from 'components/primary';
import { useBalance } from 'hooks/indexerHook';
import { openAccountExporer } from 'utils/account';

import { useTokenSymbol } from '../../hooks/network';
import { prompts } from './prompts';
import {
  AccountContainer,
  Balance,
  Buttons,
  ItemContainer,
  ItemContentContainer,
  Status,
} from './styles';
import { Controller } from './types';

type Props = {
  name: string;
  controller: string | undefined;
  onConfigController: (controller: Controller) => void;
  onRemoveController: (controller: Controller) => void;
  onWithdraw: (controller: Controller) => void;
} & Controller;

const ControllerItem: FC<Props> = ({
  id,
  name,
  controller,
  address,
  onConfigController,
  onRemoveController,
  onWithdraw,
}) => {
  const { active, activeBtn, withdrawBtn, removeBtn } = prompts.controllerItem;
  const isActived = address === controller;

  const balance = useBalance(address);
  const emptyBalance = Number(balance) === 0;
  const account = { id, address };
  const tokenSymbol = useTokenSymbol();
  return (
    <ItemContainer>
      <ItemContentContainer onClick={() => openAccountExporer(address)}>
        <Avatar address={address} size={70} />
        <AccountContainer>
          <Text size={18} fw="600">
            {name}
          </Text>
          <Text size={15} color="gray" mt={5}>
            {address}
          </Text>
        </AccountContainer>
        <Balance>{asyncRender(!!balance, <Text>{`${balance} ${tokenSymbol}`}</Text>)}</Balance>
        <Status>{isActived && <Tag state="success">{active}</Tag>}</Status>
      </ItemContentContainer>
      {asyncRender(
        !isUndefined(controller) && !isUndefined(balance),
        <Buttons>
          {!isActived && <Button title={activeBtn} onClick={() => onConfigController(account)} />}
          {!isActived && emptyBalance && (
            <Button ml={10} title={removeBtn} onClick={() => onRemoveController(account)} />
          )}
          {!emptyBalance && (
            <Button ml={10} title={withdrawBtn} onClick={() => onWithdraw(account)} />
          )}
        </Buttons>
      )}
    </ItemContainer>
  );
};

export default ControllerItem;
