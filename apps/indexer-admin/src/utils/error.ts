// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import contractErrorCodes from '@subql/contract-sdk/publish/revertcode.json';

import { notificationMsg } from 'containers/notificationContext';

import { logger } from './logger';

const getErrorMsg = (error: any) => {
  const rawErrorMsg = error?.data?.message ?? error?.message ?? error?.error ?? error ?? '';
  return rawErrorMsg;
};

export const mapContractError = (error: any) => {
  const revertCode = Object.keys(contractErrorCodes).find((key) =>
    getErrorMsg(error).toString().match(`reverted: ${key}`)
  ) as keyof typeof contractErrorCodes;
  return revertCode ? contractErrorCodes[revertCode] : undefined;
};

export const parseError = (
  error: any,
  conf: { alert?: boolean; rawMsg?: boolean } = { alert: false, rawMsg: false }
) => {
  const { alert = false, rawMsg = false } = conf;
  // logger to dev tools
  // TODO: will update print msg.
  logger.e(error);

  // show tips to users.
  const msg =
    mapContractError(error) ?? rawMsg ? getErrorMsg(error) : 'Unfortunately, something went wrong.';

  if (alert) {
    notificationMsg({
      title: 'Error',
      message: msg,
      type: 'danger',
      dismiss: {
        duration: 5000,
      },
    });
  }

  return msg;
};
