// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { FC } from 'react';
import styled from 'styled-components';

const Image = styled.img<{ size?: number }>`
  width: ${({ size }) => size ?? 30}px;
  height: ${({ size }) => size ?? 30}px;
`;

type Props = {
  src: string;
  size?: number;
  url?: string;
};

const Icon: FC<Props> = ({ src, size, url }) =>
  url ? (
    <a href={url}>
      <Image size={size} src={src} alt={url} />
    </a>
  ) : (
    <Image size={size} src={src} alt={src} />
  );

export default Icon;
