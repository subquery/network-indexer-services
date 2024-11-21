// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import React, { FC, useEffect } from 'react';
import { Markdown, Spinner, Typography } from '@subql/components';
import { Button } from 'antd';

import { useCoordinatorIndexer } from 'containers/coordinatorIndexer';
import { useNotification } from 'containers/notificationContext';
import { useIndexerMetadata } from 'hooks/indexerHook';
import { useAccountAction } from 'hooks/transactionHook';
import { AccountAction } from 'pages/project-details/types';
import { parseError } from 'utils/error';
import { createIndexerMetadata } from 'utils/ipfs';

const NodeOperatorInformation: FC = () => {
  const { indexer: account } = useCoordinatorIndexer();
  const { loading, metadata: indexerMetadata, fetchMetadata } = useIndexerMetadata(account || '');
  const accountAction = useAccountAction();
  const { dispatchNotification } = useNotification();
  const [markdownVal, setMarkdownVal] = React.useState('');
  const [saveLoading, setSaveLoading] = React.useState(false);

  const saveMetadata = async () => {
    try {
      setSaveLoading(true);
      const newMetadata = await createIndexerMetadata(
        indexerMetadata?.name || '',
        indexerMetadata?.url,
        markdownVal
      );

      await accountAction(
        AccountAction.updateMetaData,
        newMetadata,
        (error) => {
          if (error) {
            parseError(error, {
              alert: true,
            });
          }
        },
        async () => {
          await fetchMetadata();
          dispatchNotification({
            title: 'Node Operator Information updated successfully',
            message: 'Node Operator Information updated successfully',
            type: 'success',
            dismiss: {
              duration: 3000,
            },
          });
        }
      );
    } finally {
      setSaveLoading(false);
    }
  };

  useEffect(() => {
    if (indexerMetadata?.description) {
      setMarkdownVal(indexerMetadata?.description);
    }
  }, [indexerMetadata]);

  if (loading && !indexerMetadata) {
    return <Spinner />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Typography variant="h6">Node Operator Information</Typography>

      <Typography variant="medium" type="secondary">
        Provide information about yourself, this is shown publicly to Delegators and Consumers.
        Delegators and Project Owners like when they can contact Node Operators and engage with
        them. This field is not mandatory, but it may help you better connect with the SubQuery
        community.
      </Typography>

      <Markdown
        value={markdownVal}
        onChange={(val) => {
          setMarkdownVal(val || '');
        }}
      />
      {markdownVal !== indexerMetadata?.description ? (
        <div>
          <Button
            type="primary"
            shape="round"
            size="large"
            onClick={saveMetadata}
            loading={saveLoading}
          >
            Save Update Node Operator Information
          </Button>
        </div>
      ) : (
        ''
      )}
    </div>
  );
};
export default NodeOperatorInformation;
