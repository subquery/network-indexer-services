// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Button, Text } from 'components/primary';

import prompts from '../prompts';
import { InstructionContainer } from './styles';

const { instruction } = prompts.payg;

type Props = {
  onEnablePayg: () => void;
};

export function Introduction({ onEnablePayg }: Props) {
  return (
    <InstructionContainer>
      <Text size={32} fw={700}>
        {instruction.title}
      </Text>
      <Text mt={15} alignCenter size={16} color="#454F58">
        {instruction.desc[0]}
      </Text>
      <Text mt={15} alignCenter size={16} color="#454F58">
        {instruction.desc[1]}
      </Text>
      <Text mt={15} alignCenter size={16} color="#454F58">
        {instruction.sub}
        <a target="_blank" href={instruction.link} rel="noreferrer">
          here
        </a>
      </Text>
      <Button mt={25} type="secondary" title={instruction.button} onClick={onEnablePayg} />
    </InstructionContainer>
  );
}
