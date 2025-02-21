// Copyright 2020-2025 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

/* eslint-disable */
import axios, { AxiosError } from 'axios';
import { isValidPrivate, bufferToHex, privateToAddress as privateToAddressBuffer, toBuffer } from 'ethereumjs-util';
import { isUndefined } from 'lodash';

export function isMetaMaskRejectError(e: Error): boolean {
  return e.message.includes('metamask');
}

// fields validation
export function validatePrivateKey(privateKey: string): string {
  try {
    if (!privateKey.startsWith('0x')) {
      return 'Private key must start with 0x';
    }
    if (!isValidPrivate(toBuffer(privateKey))) {
      return 'Invalid private key';
    }
  } catch (_) {
    return 'Invalid private key';
  }
  return '';
}

export function isFalse(value: boolean | string | undefined) {
  return !isUndefined(value) && !value;
}

export function privateToAddress(key: string) {
  if (validatePrivateKey(key)) return '';
  return bufferToHex(privateToAddressBuffer(toBuffer(key)));
}

export function validateController(key: string, isExist?: boolean, account?: string, indexerController?: string,) {
  const error = validatePrivateKey(key);
  if (error) {
    return error;
  }

  const controllerAddress = privateToAddress(key);
  if (controllerAddress === account?.toLowerCase()) {
    return 'Can not use indexer account as controller account';
  }

  if (isExist && indexerController?.toLowerCase() !== controllerAddress) {
    return 'Controller already been used';
  }

  return '';
}

export async function verifyProxyEndpoint(url: string) {
  try {
    const { host, protocol } = new URL(url);
    const requestUrl = `${protocol}//${host}/healthy`;

    const response = await axios.get(requestUrl);
    return response.status === 200;
  } catch (error) {
    return false;
  }
}
