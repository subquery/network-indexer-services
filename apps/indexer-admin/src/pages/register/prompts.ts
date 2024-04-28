// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { TOKEN_SYMBOL } from 'utils/web3';

import { RegisterStep } from './types';

const prompts = {
  [RegisterStep.onboarding]: {
    title: 'Stake to Become a Subquery Indexer',
    desc: `Become an indexer so you can index SubQuery projects. You need to stake a minimum of 200,000 ${TOKEN_SYMBOL} in order to index SubQuery projects.`,
    buttonTitle: 'Get Started',
  },
  [RegisterStep.authorisation]: {
    title: 'Request Approval for Authorisation',
    desc: `The Indexer Admin app needs you to approve the authorisation request to deposit the ${TOKEN_SYMBOL} token into the SubQuery Staking contract. This is a one-time operation for the specific account. Please press the approve button and then confirm and send the transaction on MetaMask.`,
    buttonTitle: 'Approve',
  },
  [RegisterStep.register]: {
    title: 'Stake to Become a Subquery Indexer',
    desc: '',
    // desc: 'Become an indexer so you can index SubQuery projects. You need to stake a minimum of 14,000 SQT in order to index SubQuery projects. The time for processing the transaction depends on the current status of the network and the gas fee, and it usually takes around 30 seconds.',
    buttonTitle: 'Register Indexer',
  },
  [RegisterStep.sync]: {
    title: 'Sync the Indexer with Coordinator Service',
    desc: 'This account has already been registered as an indexer. Please press the sync button to sync this account with your coordinator service. Alternatively, you can switch your account in the wallet to select the correct account.',
    buttonTitle: 'Sync',
  },
};

export default prompts;
