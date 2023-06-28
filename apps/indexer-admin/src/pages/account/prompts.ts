// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Notification } from 'containers/notificationContext';
import { dismiss } from 'utils/notification';

const prompts = {
  indexer: {
    title: 'Indexer Account',
    name: 'Subquery Master',
    buttonTitle: 'Unregister',
    desc: '',
  },
  controller: {
    title: 'Controller Account',
    name: 'Controller',
    buttonTitle: 'Update Controller',
    desc: '',
  },
  emptyController: {
    title: 'Controller Account',
    name: '',
    buttonTitle: 'Configure Controller',
    desc: 'The controller account is a delegator of the indexer. You need to configure a controller account before you start indexing projects. The controller account will be configured in your coordinator service and will send the status of the indexing services to the contract automatically.',
  },
};

export const notifications = {
  controller: {
    type: 'danger',
    title: 'Insufficient Balance',
    message:
      'The controller account has insufficient funds to pay the transaction fee. Please top up your controller account as soon as possible.',
    dismiss: dismiss(50000, false),
  } as Notification,
};

export default prompts;
