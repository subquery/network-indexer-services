// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { ContractTransaction } from 'ethers';

import { Notification, notificationContext } from 'containers/notificationContext';

import { dismiss } from './notification';

const formatHash = (hash: string) => {
  const len = hash.length;
  return `${hash.substring(0, 15)}...${hash.substring(len - 16, len - 1)}`;
};

export function txLoadingNotification(title: string, txHash: string): Notification {
  return {
    type: 'default',
    title,
    message: `Processing transaction may take around 20s: ${formatHash(txHash)}`,
    dismiss: dismiss(50000, true),
  };
}

export function txSuccessNotification(name: string): Notification {
  return {
    type: 'success',
    title: 'Transaction Succeed',
    message: `${name.toLowerCase()} completed`,
    dismiss: dismiss(),
  };
}

export function txErrorNotification(message: string): Notification {
  return {
    type: 'danger',
    title: 'Transaction Failed',
    message: `${message}`,
    dismiss: dismiss(),
  };
}

export async function handleTransaction(
  name: string,
  tx: ContractTransaction,
  notificationContext: notificationContext,
  onSuccess?: () => void,
  onError?: () => void
) {
  const { dispatchNotification, removeNotification } = notificationContext;
  const loadingId = dispatchNotification(txLoadingNotification(name, tx.hash));

  try {
    const receipt = await tx.wait(1);
    if (!receipt.status) {
      onError && onError();
      dispatchNotification(txErrorNotification(tx.hash));
    } else {
      onSuccess && onSuccess();
      dispatchNotification(txSuccessNotification(name));
    }
    removeNotification(loadingId);
  } catch (e) {
    console.error('Transaction Failed:', e);
    // @ts-ignore
    dispatchNotification(txErrorNotification(e.message));
  }
}
