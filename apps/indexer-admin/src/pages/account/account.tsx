// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router';
import { useMutation } from '@apollo/client';
import { isUndefined } from 'lodash';
import { useBalance } from 'wagmi';

import AccountCard from 'components/accountCard';
import { LoadingSpinner } from 'components/loading';
import { PopupView } from 'components/popupView';
import { useCoordinatorIndexer } from 'containers/coordinatorIndexer';
import { useNotification } from 'containers/notificationContext';
import { useController, useIndexerMetadata, useIsIndexer } from 'hooks/indexerHook';
import { useTokenSymbol } from 'hooks/network';
import { useAccountAction } from 'hooks/transactionHook';
import { AccountAction } from 'pages/project-details/types';
import { MetadataFormKey } from 'types/schemas';
import { balanceSufficient } from 'utils/account';
import { parseError } from 'utils/error';
import { createIndexerMetadata } from 'utils/ipfs';
import { REMOVE_ACCOUNTS } from 'utils/queries';
import { formatValueToFixed } from 'utils/units';

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

  const { loading: isIndexerLoading, data: isIndexer } = useIsIndexer();
  const { indexer: account, setIndexer } = useCoordinatorIndexer();
  const { metadata, fetchMetadata, loading } = useIndexerMetadata(account || '');
  const accountAction = useAccountAction();
  const { controller } = useController();
  const {
    data: controllerBalance,
    isLoading,
    isRefetching,
  } = useBalance({
    address: controller as `0x${string}`,
  });
  const { data: indexerBalance } = useBalance({
    address: account as `0x${string}`,
  });
  const { dispatchNotification } = useNotification();
  const history = useHistory();
  const tokenSymbol = useTokenSymbol();

  const [removeAccounts] = useMutation(REMOVE_ACCOUNTS);

  prompts.controller.desc = `Balance: ${formatValueToFixed(
    +(controllerBalance?.formatted || 0),
    6
  )} ${tokenSymbol}`;
  const controllerItem = !controller ? prompts.emptyController : prompts.controller;
  const indexerItem = prompts.indexer;

  useEffect(() => {
    if (
      !isLoading &&
      !isRefetching &&
      controllerBalance &&
      !balanceSufficient(controllerBalance.formatted)
    ) {
      dispatchNotification(notifications.controller);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controllerBalance]);

  const onButtonPress = (type?: AccountAction) => {
    setActionType(type);
    setVisible(true);
  };

  const onModalClose = (error?: any) => {
    if (error) {
      parseError(error, {
        alert: true,
      });
      return;
    }
    setVisible(false);
    setTimeout(() => setCurrentStep(0), 1000);
  };

  const indexerName = useMemo(() => metadata?.name ?? ' ', [metadata]);

  const indexerButtons = [
    createButtonItem(AccountAction.updateMetaData, onButtonPress, loading),
    createButtonItem(AccountAction.unregister, onButtonPress),
  ];

  const controllerButtons = [
    {
      title: 'Manage Controllers',
      onClick: () => history.push('/controller-management'),
    } as AccountButtonItem,
  ];

  const updateMetadataStep = useMemo(
    () =>
      createUpdateMetadataSteps(async (values, formHelper) => {
        formHelper.setStatus({ loading: true });
        try {
          const name = values[MetadataFormKey.name];
          const proxyEndpoint = values[MetadataFormKey.proxyEndpoint];
          const metadata = await createIndexerMetadata(name, proxyEndpoint);
          await accountAction(AccountAction.updateMetaData, metadata, onModalClose, fetchMetadata);
        } finally {
          formHelper.setStatus({ loading: false });
        }
      }, metadata),
    [accountAction, fetchMetadata, metadata]
  );

  const unregisterCompleted = async () => {
    await removeAccounts();
    setIndexer(undefined);
    history.replace('/register');
  };

  const unregisterStep = createUnregisterSteps(() =>
    accountAction(AccountAction.unregister, '', onModalClose, unregisterCompleted)
  );

  const steps = useMemo(
    () => ({ ...unregisterStep, ...updateMetadataStep }),
    [unregisterStep, updateMetadataStep]
  );

  if (isUndefined(account) || isUndefined(account) || isIndexerLoading) return <LoadingSpinner />;

  return (
    <Container>
      {isIndexer && (
        <AccountCard
          title={indexerItem.title}
          name={indexerName}
          buttons={indexerButtons}
          account={account ?? ''}
          desc={`Balance: ${formatValueToFixed(
            +(indexerBalance?.formatted || 0),
            6
          )} ${tokenSymbol}`}
        />
      )}
      {isIndexer && (
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
          onClose={() => onModalClose()}
          steps={steps[actionType]}
          currentStep={currentStep}
          type={actionType}
        />
      )}
    </Container>
  );
};

export default Account;
