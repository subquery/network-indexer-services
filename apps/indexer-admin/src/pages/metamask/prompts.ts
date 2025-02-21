// Copyright 2020-2025 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Account } from 'pages/account/types';

const prompts = (account: Account) => ({
  install: {
    title: 'Install MetaMask to Use Indexer App',
    desc: 'No MetaMask extension found in the browser. Please click the button to install the MetaMask extension before connecting to the network.',
    buttonTitle: 'Install MetaMask in the extension market',
  },
  connect: {
    title: 'Connect Wallet to Use Indexer App',
    desc: 'Use the indexer app to connect with the Subquery network. You can manage your accounts and projects inside the app.',
    buttonTitle: 'Connect with MetaMask Browser Extension',
  },
  invalidAccount: {
    title: 'Incorrect Connected Account with Coordinator Service',
    desc: `Please switch the connected account to ${account}.`,
    buttonTitle: 'Switching the account to use the Admin App manually',
  },
  invalidNetwork: {
    title: 'Unsupported Network Type',
    desc: 'MetaMask is connected to an unsupported network. Please press the button to switch to the correct network.',
    buttonTitle: 'Switch to the Supported Network',
  },
});

export default prompts;
