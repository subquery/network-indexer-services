// Copyright 2020-2025 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation } from '@apollo/client';

import { useContractSDK } from 'containers/contractSdk';
import { useNotification } from 'containers/notificationContext';
import { AccountActionName } from 'pages/account/config';
import { ControllerAction } from 'pages/controllers/types';
import { AccountAction, ProjectAction, TransactionType } from 'pages/project-details/types';
import {
  configController,
  getIndexMetadata,
  unRegister,
  updateMetadata,
} from 'utils/indexerActions';
import { ANNOUNCE_READY, ANNOUNCE_STOP } from 'utils/queries';
import { handleTransaction } from 'utils/transactions';
import { sleep } from 'utils/waitForSomething';

import { useSignerOrProvider } from './web3Hook';

type Callback = (e?: any) => any | Promise<any> | undefined;
type AccountTxType = AccountAction | ControllerAction.configController;
const ActionNames = {
  ...AccountActionName,
  [ControllerAction.configController]: 'Update Controller',
};

export const useAccountAction = () => {
  const signer = useSignerOrProvider();
  const sdk = useContractSDK();
  const notificationContext = useNotification();

  const accountTransactions = useCallback(
    (param: string) => ({
      [AccountAction.updateMetaData]: () => updateMetadata(sdk, signer, param),
      [AccountAction.unregister]: () => unRegister(sdk, signer),
      [ControllerAction.configController]: () => configController(sdk, signer, param),
    }),
    [sdk, signer]
  );

  return useCallback(
    async (type: AccountTxType, param: string, onProcess: Callback, onSuccess?: Callback) => {
      try {
        const sendTx = accountTransactions(param)[type];
        const actionName = ActionNames[type];
        const tx = await sendTx();
        onProcess();
        await handleTransaction(actionName, tx, notificationContext, onSuccess);
      } catch (e) {
        onProcess(e);
      }
    },
    [accountTransactions, notificationContext]
  );
};

export const useIndexingAction = (id: string) => {
  const [announceReady] = useMutation(ANNOUNCE_READY);
  const [announceStop] = useMutation(ANNOUNCE_STOP);

  const indexingTransactions = useMemo(
    () => ({
      [ProjectAction.AnnounceReady]: async () => {
        await announceReady({
          variables: {
            id,
          },
        });
      },
      [ProjectAction.AnnounceTerminating]: async () => {
        await announceStop({
          variables: {
            id,
          },
        });
      },
    }),
    [announceReady, announceStop, id]
  );

  return useCallback(
    async (type: TransactionType, onProcess: Callback, onSuccess?: Callback) => {
      try {
        const sendTx = indexingTransactions[type];
        await sendTx();
        await sleep();
        onProcess();
        onSuccess?.();
      } catch (e) {
        onProcess(e);
      }
    },
    [indexingTransactions]
  );
};

export const useGetIndexerMetadataCid = (indexer: string) => {
  const signer = useSignerOrProvider();

  const sdk = useContractSDK();
  const [metadataCid, setMetadataCid] = useState<string>();

  const getIndexerMetadata = async () => {
    if (!sdk) return;

    const res = await getIndexMetadata(sdk, signer, indexer);
    setMetadataCid(res);
  };

  useEffect(() => {
    getIndexerMetadata();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indexer, sdk, signer]);

  return metadataCid;
};
