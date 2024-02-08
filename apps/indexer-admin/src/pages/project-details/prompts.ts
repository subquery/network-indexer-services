// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { SUPPORTED_NETWORK_PROJECTS_EXPLORER } from 'utils/web3';

const prompts = {
  // project management
  project: {
    start: {
      title: 'Indexing Project',
      desc: 'Starting the indexing process for the project will start the SubQuery node service and indexing the project, and also start a query service at the same time. It takes around 1 minute to start the services. Once everything is ready, you can view the progress and related information.',
    },
    stop: {
      title: 'Stop Indexing the Project',
      desc: 'Stopping the indexing process for the project will terminate the node and query services. Once the services are stopped, the service status will change to "Terminated". You can restart indexing the project at any time.',
    },
    restart: {
      title: 'Restart Project',
      desc: 'Restarting the indexing process for the project will start the previous SubQuery node service to index the project and also start a query service at the same time. You can view the progress and related information once everything is ready.',
    },
    remove: {
      title: 'Are you sure you want to remove the project?',
      desc: 'Removing the project will remove the project and service containers from the coordinator service and database, and the indexing data will also be removed. You can add the project back at any time, but it will need to be reindexed from the beginning.',
    },
  },
  // Indexing management on chain
  announce: {
    indexing: {
      title: 'Update Status on Subquery Network',
      desc: 'This action initiates a transaction to start indexing the project on the contract. Once the transaction is completed, the controller account on the coordinator service will begin updating the status of the indexing service on the contract. The transaction processing time may take around 10 seconds and will depend on the network and gas fee. You will be able to see the processing status on the top of the page once the transaction is confirmed on the MetaMask.',
    },
    ready: {
      title: 'Update Indexing To Ready',
      desc: 'This action initiates a transaction to change the indexing status to "ready" on the contract. Once the transaction is completed, the explorer will display your query endpoint. The transaction processing time may take around 10 seconds and will depend on the network and gas fee. You will be able to see the processing status on the top of the page once the transaction is confirmed on the MetaMask.',
    },
    notIndexing: {
      title: 'Announce Not Indexing the Project',
      desc: 'This action initiates a transaction to change the indexing status to "not indexing" on the contract. The project status will change to "not indexing" on the network. The transaction processing time may take around 10 seconds and will depend on the network and gas fee. You will be able to see the processing status on the top of the page once the transaction is confirmed on the MetaMask.',
    },
  },
  // PAYG
  payg: {
    instruction: {
      title: 'Flex Plan',
      desc: [
        'The Flex Plan is a fast and transactional payment plan. As an Indexer, you can advertise your Flex Plan price for each SubQuery project that you have announced you are ready to index.',
        'Consumers can make as many requests to your projects as they wish and will be charged at a price per request. At the end of an Era, these tokens will be distributed to all participating indexers based on the Cobb-Douglas production function.',
      ],
      sub: 'Learn more',
      link: SUPPORTED_NETWORK_PROJECTS_EXPLORER,
      button: 'Enable Flex Plan',
    },
    open: {
      title: 'Enable Flex Plan',
      desc: 'This will enable the pay-as-you-go function, which supports micro-payments and instant requests. The query service will be based on HTTP and p2p network at the same time. If a consumer establishes the service, it will be in the form of a state channel.',
    },
    channels: {
      title: 'Flex Plans',
      tabs: {
        open: 'Ongoing',
        expired: 'Expired',
        closed: 'Closed',
      },
    },
  },
  // TODO: remove later
  paygChangePrice: {
    title: 'Change Price',
    desc: 'This will modify the cost per query. The price of the established state channel will remain unchanged, and the new state channel will use the new price.',
  },
  paygClose: {
    title: 'Close PAYG',
    desc: 'This will turn off the pay-as-you-go function. The already established state channel will not be affected, and no new state channels will be established.',
  },
};

export default prompts;
