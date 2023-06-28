// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { NOTIFICATION_TYPE } from 'react-notifications-component';

export const prompts = {
  header: {
    mainTitle: 'Manage Controller Accounts',
    title: 'Create and manage your controller accounts here.',
    subTitle:
      'You can configure the account you wish to set as the controller on the coordinator service.',
    button: 'Create an Account',
  },
  intro: {
    title: 'Manage Controller Accounts',
    desc: 'You can create as many accounts as you want. You can then configure the one you wish to set as the controller on the coordinator service.',
    buttonTitle: 'Create an Account',
  },
  action: {
    configController: {
      title: 'Activate Your Controller on Contract',
      desc: 'Press the button to send the transaction to the network and update the new controller account on the contract. The transaction processing time may take around 10s, depending on the network status and gas fee. You will see the processing status on the top of the page once you confirm the transaction on MetaMask.',
      buttonTitle: 'Send Transaction',
    },
    removeAccount: {
      title: 'Remove This Account',
      desc: 'This action will remove the account from your coordinator service. You will not be able to find this account again once you confirm removal. Please make sure there are no assets in this account. Are you sure you want to remove it?',
      buttonTitle: 'Confirm Removal',
    },
    withdraw: {
      title: 'Withdraw from Controller Account',
      desc: 'You are about to withdraw the full balance from this account to your index account. The amount you receive will be the full balance minus the transaction fee. The transaction fee is determined by the network.',
      buttonTitle: 'Confirm Withdrawal',
    },
  },
  controllerItem: {
    active: 'Active',
    activeBtn: 'Activate',
    withdrawBtn: 'Withdraw',
    removeBtn: 'Remove',
  },
  notification: {
    withdrawal: {
      loading: {
        type: 'default' as NOTIFICATION_TYPE,
        title: 'Controller Withdrawal',
        message: (c: string) =>
          `Withdrawing all assets for controller: ${c} may take up to 20 seconds.`,
      },
      success: {
        type: 'success' as NOTIFICATION_TYPE,
        title: 'Controller Withdrawal Succeeded',
        message: (c: string) => `Successfully withdrew assets for controller: ${c}`,
      },
      failed: {
        type: 'danger' as NOTIFICATION_TYPE,
        title: 'Controller Withdrawal Failed',
        message: (c: string) => `Failed to withdraw assets for controller: ${c}`,
      },
    },
  },
};
