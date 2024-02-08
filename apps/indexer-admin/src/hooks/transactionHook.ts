// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useContractSDK } from 'containers/contractSdk';
import { useNotification } from 'containers/notificationContext';
import { AccountActionName } from 'pages/account/config';
import { ControllerAction } from 'pages/controllers/types';
import { ProjectActionName } from 'pages/project-details/config';
import { AccountAction, ProjectAction, TransactionType } from 'pages/project-details/types';
import {
  configController,
  getIndexMetadata,
  readyIndexing,
  stopIndexing,
  unRegister,
  updateMetadata,
} from 'utils/indexerActions';
import { handleTransaction } from 'utils/transactions';

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
  const signer = useSignerOrProvider();

  const sdk = useContractSDK();
  const notificationContext = useNotification();

  const indexingTransactions = useMemo(
    () => ({
      [ProjectAction.AnnounceReady]: () => readyIndexing(sdk, signer, id),
      [ProjectAction.AnnounceTerminating]: () => stopIndexing(sdk, signer, id),
    }),
    [sdk, signer, id]
  );

  return useCallback(
    async (type: TransactionType, onProcess: Callback, onSuccess?: Callback) => {
      try {
        const sendTx = indexingTransactions[type];
        const actionName = ProjectActionName[type];
        const tx = await sendTx();
        onProcess();
        await handleTransaction(actionName, tx, notificationContext, onSuccess);
      } catch (e) {
        onProcess(e);
      }
    },
    [indexingTransactions, notificationContext]
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
