// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import contractErrorCodes from '@subql/contract-sdk/publish/revertcode.json';

import { notificationMsg } from 'containers/notificationContext';

import { logger } from './logger';

const getErrorMsg = (error: any) => {
  const rawErrorMsg = error?.data?.message ?? error?.message ?? error?.error ?? error ?? '';
  return rawErrorMsg;
};

export const mapContractError = (error: any) => {
  const revertCode = Object.keys(contractErrorCodes).find(
    (key) =>
      getErrorMsg(error).toString().match(`reverted: ${key}`) ||
      getErrorMsg(error).toString().match(`revert: ${key}`)
  ) as keyof typeof contractErrorCodes;

  const getExtraExplain = (revertCode: 'IR004' | 'RS002') => {
    const msg = {
      IR004: 'Please terminate all the projects',
      RS002: 'Please check controller account balance enough to do transaction',
    };

    return msg[revertCode];
  };

  const extraExplain =
    revertCode === 'IR004' || revertCode === 'RS002' ? getExtraExplain(revertCode) : '';

  return revertCode ? `${contractErrorCodes[revertCode]}. ${extraExplain}` : undefined;
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
  const msg = rawMsg
    ? getErrorMsg(error)
    : mapContractError(error) ?? 'Unfortunately, something went wrong.';

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
