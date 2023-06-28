// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router';
import { useMutation } from '@apollo/client';
import { isUndefined } from 'lodash';

import AccountCard from 'components/accountCard';
import { PopupView } from 'components/popupView';
import { useAccount } from 'containers/account';
import { useCoordinatorIndexer } from 'containers/coordinatorIndexer';
import { useLoading } from 'containers/loadingContext';
import { useNotification } from 'containers/notificationContext';
import {
  useBalance,
  useController,
  useIndexerMetadata,
  useIsController,
  useIsIndexer,
} from 'hooks/indexerHook';
import { useTokenSymbol } from 'hooks/network';
import { useAccountAction } from 'hooks/transactionHook';
import { useIsMetaMask } from 'hooks/web3Hook';
import { AccountAction } from 'pages/project-details/types';
import { MetadataFormKey } from 'types/schemas';
import { balanceSufficient } from 'utils/account';
import { createIndexerMetadata } from 'utils/ipfs';
import { REMOVE_ACCOUNTS } from 'utils/queries';

import {
  AccountActionName,
  createButtonItem,
  createUnregisterSteps,
  createUpdateMetadataSteps,
} from './config';
import prompts, { notifications } from './prompts';
import { Container } from './styles';
import { AccountButtonItem } from './types';

const Account = () => {
  const [visible, setVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [actionType, setActionType] = useState<AccountAction>();

  const { account } = useAccount();
  const isIndexer = useIsIndexer();
  const { indexer } = useCoordinatorIndexer();
  const { metadata, fetchMetadata } = useIndexerMetadata();
  const accountAction = useAccountAction();
  const isMetaMask = useIsMetaMask();
  const isController = useIsController(account);
  const { controller } = useController();
  const controllerBalance = useBalance(controller);
  const indexerBalance = useBalance(account);
  const { dispatchNotification } = useNotification();
  const { setPageLoading } = useLoading();
  const history = useHistory();
  const tokenSymbol = useTokenSymbol();

  const [removeAccounts] = useMutation(REMOVE_ACCOUNTS);

  prompts.controller.desc = `Balance: ${controllerBalance} ${tokenSymbol}`;
  const controllerItem = !controller ? prompts.emptyController : prompts.controller;
  const indexerItem = prompts.indexer;

  useEffect(() => {
    setPageLoading(isUndefined(account) || isUndefined(indexer));
  }, [account, indexer, setPageLoading]);

  useEffect(() => {
    if (controllerBalance && !balanceSufficient(controllerBalance)) {
      dispatchNotification(notifications.controller);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controllerBalance]);

  const onButtonPress = (type?: AccountAction) => {
    setActionType(type);
    setVisible(true);
  };

  const onModalClose = () => {
    setVisible(false);
    setTimeout(() => setCurrentStep(0), 1000);
  };

  const indexerName = useMemo(() => metadata?.name ?? ' ', [metadata]);

  const indexerButtons = [
    createButtonItem(AccountAction.updateMetaData, onButtonPress),
    createButtonItem(AccountAction.unregister, onButtonPress),
  ];

  const controllerButtons = [
    {
      title: 'Manange Controllers',
      onClick: () => history.push('/controller-management'),
    } as AccountButtonItem,
  ];

  const updateMetadataStep = useMemo(
    () =>
      createUpdateMetadataSteps(async (values, formHelper) => {
        formHelper.setStatus({ loading: true });
        const name = values[MetadataFormKey.name];
        const proxyEndpoint = values[MetadataFormKey.proxyEndpoint];
        const metadata = await createIndexerMetadata(name, proxyEndpoint);
        await accountAction(AccountAction.updateMetaData, metadata, onModalClose, fetchMetadata);
      }, metadata),
    [accountAction, fetchMetadata, metadata]
  );

  const unregisterCompleted = async () => {
    await removeAccounts();
    history.replace('/register');
  };

  const unregisterStep = createUnregisterSteps(() =>
    accountAction(AccountAction.unregister, '', onModalClose, unregisterCompleted)
  );

  const steps = useMemo(
    () => ({ ...unregisterStep, ...updateMetadataStep }),
    [unregisterStep, updateMetadataStep]
  );

  return (
    <Container>
      {isMetaMask && isIndexer && (
        <AccountCard
          title={indexerItem.title}
          name={indexerName}
          buttons={indexerButtons}
          account={account ?? ''}
          desc={`Balance: ${indexerBalance} ${tokenSymbol}`}
        />
      )}
      {(isIndexer || isController) && (
        <AccountCard
          key={2}
          title={controllerItem.title}
          name={controllerItem.name}
          account={controller}
          buttons={controllerButtons}
          desc={controllerItem?.desc}
        />
      )}
      {actionType && (
        <PopupView
          setVisible={setVisible}
          visible={visible}
          title={AccountActionName[actionType]}
          onClose={onModalClose}
          steps={steps[actionType]}
          currentStep={currentStep}
          type={actionType}
        />
      )}
    </Container>
  );
};

export default Account;
