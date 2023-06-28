// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Notification } from 'containers/notificationContext';
import { ClickAction } from 'pages/project-details/types';
import { dismiss } from 'utils/notification';

import { prompts } from './prompts';
import { ControllerAction } from './types';

const { action, notification } = prompts;

// TODO: export to global
type ModalInfo = {
  title: string;
  desc: string;
  buttonTitle: string;
};

const createModalStep = (info: ModalInfo, action: ClickAction) => ({
  index: 0,
  title: info.title,
  desc: info.desc,
  buttonTitle: info.buttonTitle,
  onClick: action,
});

export const createConfigControllerSteps = (onSendTxConfigController: ClickAction) => ({
  [ControllerAction.configController]: [
    createModalStep(action.configController, onSendTxConfigController),
  ],
});

export const createRemoveAccountSteps = (removeAccount: ClickAction) => ({
  [ControllerAction.removeAccount]: [createModalStep(action.removeAccount, removeAccount)],
});

export const createWithdrawSteps = (withdraw: ClickAction) => ({
  [ControllerAction.withdraw]: [createModalStep(action.withdraw, withdraw)],
});

// notifications
export const withdrawControllerLoading = (controller = ''): Notification => {
  const { type, title, message } = notification.withdrawal.loading;
  return {
    type,
    title,
    message: message(controller),
    dismiss: dismiss(30000, true),
  };
};

export const withdrawControllerSucceed = (controller = ''): Notification => {
  const { type, title, message } = notification.withdrawal.success;
  return {
    type,
    title,
    message: message(controller),
    dismiss: dismiss(),
  };
};

export const withdrawControllerFailed = (controller = ''): Notification => {
  const { type, title, message } = notification.withdrawal.failed;
  return {
    type,
    title,
    message: message(controller),
    dismiss: dismiss(),
  };
};
