// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { AccountAction, ClickAction, FormSubmit } from 'pages/project-details/types';
import { initialMetadataValues, MetadataFormKey, MetadataFormSchema } from 'types/schemas';

import { AccountButtonItem, IndexerMetadata } from './types';

const buttonTitles = {
  [AccountAction.unregister]: 'Unregister',
  [AccountAction.updateMetaData]: 'Update Metadata',
};

export const createButtonItem = (
  actionType: AccountAction,
  onClick: (type?: AccountAction) => void
): AccountButtonItem => {
  return {
    title: buttonTitles[actionType],
    type: actionType,
    onClick,
  };
};

export const AccountActionName = {
  [AccountAction.updateMetaData]: 'Update Indexer Metadata',
  [AccountAction.unregister]: 'Unregister Indexer Account',
};

// TODO: refactor refer to `/controllers/config.ts`
export const createUnregisterSteps = (onUnregister: ClickAction) => ({
  [AccountAction.unregister]: [
    {
      index: 0,
      title: 'Unregister from network',
      desc: `Sorry to see your indexer unregister from the Subquery Network. Please note that all data in your coordinator service will be removed, and the staking tokens will be deposited into your current account once the transaction is processed.`,
      buttonTitle: 'Unregister',
      onClick: onUnregister,
    },
  ],
});

export const createUpdateMetadataSteps = (onUpdate: FormSubmit, metadata?: IndexerMetadata) => ({
  [AccountAction.updateMetaData]: [
    {
      index: 0,
      title: 'Update Indexer Metadata',
      desc: `Please enter a valid indexer name and proxy server endpoint to update the metadata. Ensure that the proxy endpoint is valid.`,
      buttonTitle: 'Update Metadata',
      form: {
        formValues: initialMetadataValues(metadata),
        schema: MetadataFormSchema,
        onFormSubmit: onUpdate,
        items: [
          {
            formKey: MetadataFormKey.name,
            title: 'Indexer Name',
          },
          {
            formKey: MetadataFormKey.proxyEndpoint,
            title: 'Proxy Server Endpoint',
          },
        ],
      },
    },
  ],
});
