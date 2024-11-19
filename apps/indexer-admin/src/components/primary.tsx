// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { FC } from 'react';
import { Button as SubButton, Spinner } from '@subql/components';
import { Form } from 'formik';
import styled from 'styled-components';

export const Separator = styled.div<{
  height?: number;
  width?: number;
  color?: string;
  mr?: number;
  ml?: number;
}>`
  height: ${({ height }) => height ?? 1}px;
  width: ${({ width }) => width ?? 1}px;
  background-color: ${({ color }) => color ?? 'lightgray'};
  margin-right: ${({ mr }) => mr ?? 0}px;
  margin-left: ${({ mr }) => mr ?? 0}px;
`;

type TextProps = {
  size?: number;
  fw?: string | number;
  ml?: number;
  mr?: number;
  mt?: number;
  mb?: number;
  mw?: number;
  clolor?: string;
  alignCenter?: boolean;
  ff?: string;
};

export const Text = styled.div<TextProps>`
  color: ${({ color }) => color ?? '#1A202C'};
  text-align: ${({ alignCenter }) => (alignCenter ? 'center' : 'left')};
  font-size: ${({ size }) => size ?? 18}px;
  font-weight: ${({ fw }) => fw ?? 400};
  margin-left: ${({ ml }) => ml ?? 0}px;
  margin-right: ${({ mr }) => mr ?? 0}px;
  margin-top: ${({ mt }) => mt ?? 0}px;
  margin-bottom: ${({ mb }) => mb ?? 0}px;
  min-width: ${({ mw }) => mw ?? 10}px;
  overflow-wrap: anywhere;
  min-height: 20.7px;
`;

export const Label = styled.label<TextProps>`
  color: ${({ color }) => color ?? '#1A202C'};
  text-align: ${({ alignCenter }) => (alignCenter ? 'center' : 'left')};
  font-size: ${({ size }) => size ?? 15}px;
  font-weight: ${({ fw }) => fw ?? 500};
  margin-left: ${({ ml }) => ml ?? 0}px;
  margin-right: ${({ mr }) => mr ?? 0}px;
  margin-top: ${({ mt }) => mt ?? 0}px;
  margin-bottom: ${({ mb }) => mb ?? 0}px;
  min-width: ${({ mw }) => mw ?? 10}px;
  font-family: ${({ ff }) => ff ?? 'Futura'};
`;

// new buttons
type StyledButtonProps = {
  align?: string;
  width?: number;
  mt?: number;
  mb?: number;
  mr?: number;
  ml?: number;
};

export const StyledButton = styled(SubButton)<StyledButtonProps>`
  @property --start-color {
    syntax: '<color>';
    initial-value: #ffffff14;
    inherits: false;
  }

  @property --end-color {
    syntax: '<color>';
    initial-value: #ffffff14;
    inherits: false;
  }

  align-self: ${({ align }) => align ?? 'center'};
  min-width: ${({ width }) => width ?? 150}px;
  padding: 16px 50px;
  margin-top: ${({ mt }) => mt ?? 0}px;
  margin-bottom: ${({ mb }) => mb ?? 0}px;
  margin-right: ${({ mr }) => mr ?? 0}px;
  margin-left: ${({ ml }) => ml ?? 0}px;
  font-weight: 500;
  box-sizing: border-box;
  height: 50px;
  background: linear-gradient(
    96.26deg,
    var(--start-color) 13.8%,
    var(--end-color) 82.83%
  ) !important;
  transition: --start-color 0.3s ease, --end-color 0.3s ease;

  &:hover {
    --start-color: #4388dd14;
    --end-color: #ff458114;
  }
`;

type ButtonProps = {
  title: string;
  loading?: boolean;
  disabled?: boolean;
  leftItem?: React.ReactNode;
  type?: 'primary' | 'secondary';
  onClick?: () => void;
};

const Spin = styled(Spinner)`
  margin-right: 15px;
`;

export const Button: FC<ButtonProps & StyledButtonProps> = ({
  title,
  loading,
  disabled,
  type,
  ...props
}) => (
  <StyledButton
    label={title}
    type={type ?? 'secondary'}
    leftItem={loading && <Spin size={16} color={`${type === 'primary' ? '#fff' : '#4388dd'}`} />}
    disabled={disabled || loading}
    {...props}
  />
);

type Align = 'left' | 'right' | 'centre';

export const ButtonContainer = styled.div<{ mt?: number; align?: Align }>`
  display: flex;
  align-items: center;
  margin-top: ${({ mt }) => mt ?? 0}px;
  width: 100%;
  justify-content: ${({ align }) => {
    if (!align) return 'center';
    switch (align) {
      case 'left':
        return 'flex-start';
      case 'right':
        return 'flex-end';
      default:
        return 'center';
    }
  }};
`;

export const FormContainer = styled(Form)<{ mt?: number }>`
  margin-top: ${({ mt }) => mt ?? 0}px;
  width: 100%;
`;
