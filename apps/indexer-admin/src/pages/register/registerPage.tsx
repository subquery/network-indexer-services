// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { FormikHelpers } from 'formik';
import { isUndefined } from 'lodash';

import IntroductionView from 'components/introductionView';
import { LoadingSpinner } from 'components/loading';
import { useAccount } from 'containers/account';
import { useContractSDK } from 'containers/contractSdk';
import { useCoordinatorIndexer } from 'containers/coordinatorIndexer';
import { useNotification } from 'containers/notificationContext';
import { useIsIndexer, useIsRegistedIndexer, useTokenBalance } from 'hooks/indexerHook';
import { useInitialStep } from 'hooks/registerHook';
import { useSignerOrProvider } from 'hooks/web3Hook';
import { RegisterFormKey, TRegisterValues } from 'types/schemas';
import { parseError } from 'utils/error';
import { indexerRegistry, indexerRequestApprove } from 'utils/indexerActions';
import { createIndexerMetadata } from 'utils/ipfs';
import { verifyProxyEndpoint } from 'utils/validateService';
import { TOKEN_SYMBOL } from 'utils/web3';

import { Container } from '../login/styles';
import IndexerRegistryView from './indexerRegistryView';
import prompts from './prompts';
import { RegistrySteps } from './styles';
import { RegisterStep } from './types';
import { getStepIndex, getStepStatus, registerSteps } from './utils';

// TODO: refactor
const RegisterPage = () => {
  const signer = useSignerOrProvider();

  const { account } = useAccount();
  const { isRegisterIndexer } = useIsRegistedIndexer();
  const isIndexer = useIsIndexer();
  const sdk = useContractSDK();
  const { tokenBalance, getTokenBalance } = useTokenBalance(account);
  const history = useHistory();
  const initialStep = useInitialStep();
  const { updateIndexer } = useCoordinatorIndexer();
  const { dispatchNotification } = useNotification();

  const [currentStep, setStep] = useState<RegisterStep>();
  const [loading, setLoading] = useState<boolean>(false);

  const isRegisterStep = useCallback(() => currentStep === RegisterStep.register, [currentStep]);
  useEffect(() => {
    if (initialStep) setStep(initialStep);
    if (isRegisterIndexer) setStep(RegisterStep.sync);
  }, [initialStep, isRegisterIndexer]);

  useEffect(() => {
    if (!account) {
      history.replace('/');
    } else if (isIndexer) {
      history.replace('/account');
    }
  }, [isIndexer, account, history]);

  const item = useMemo(() => currentStep && prompts[currentStep], [currentStep]);

  const moveToNextStep = () => {
    setLoading(false);
    setStep(registerSteps[getStepIndex(currentStep) + 1] as RegisterStep);
  };

  const onTransactionFailed = (error: any) => {
    console.error('Send transaction failed:', error);
    dispatchNotification({
      type: 'danger',
      title: 'Send transaction failed',
      message: parseError(error),
      dismiss: {
        duration: 5000,
      },
    });
    setLoading(false);
  };

  const onSyncIndexer = useCallback(async () => {
    setLoading(true);
    if (!account) {
      return dispatchNotification({
        type: 'danger',
        title: 'Fail to sync the indexer',
        message: 'Can not find account, make sure MetaMask is connected',
      });
    }

    await updateIndexer(account);
    setLoading(false);
    return history.replace('/account');
  }, [account, dispatchNotification, history, updateIndexer]);

  const onApprove = async () => {
    setLoading(true);
    try {
      const tx = await indexerRequestApprove(sdk, signer, '100000000000');
      const receipt = await tx.wait(1);
      if (!receipt.status) {
        throw new Error('Send approve transaction failed');
      }
      moveToNextStep();
    } catch (e) {
      onTransactionFailed(e);
    }
  };

  const onIndexerRegister = async (
    values: TRegisterValues,
    helper: FormikHelpers<TRegisterValues>
  ) => {
    try {
      setLoading(true);
      await getTokenBalance();

      const { name, proxyEndpoint, amount, rate } = values;
      if (Number(tokenBalance) < amount) {
        setLoading(false);
        helper.setErrors({
          [RegisterFormKey.amount]: `Account balance ${tokenBalance} is not enough for staking ${amount} ${TOKEN_SYMBOL}`,
        });
        return;
      }

      const isValidProxyEndpoint = await verifyProxyEndpoint(proxyEndpoint);
      if (!isValidProxyEndpoint) {
        setLoading(false);
        helper.setErrors({ [RegisterFormKey.proxyEndpoint]: 'Invalid proxy endpoint' });
        return;
      }

      const indexerMetadata = await createIndexerMetadata(name, proxyEndpoint);
      const tx = await indexerRegistry(
        sdk,
        signer,
        amount.toString(),
        indexerMetadata,
        rate * 10000
      );
      const receipt = await tx.wait(1);
      if (!receipt.status) {
        throw new Error('Send indexer registry transaction failed');
      }

      moveToNextStep();
    } catch (e) {
      onTransactionFailed(e);
    }
  };

  const registerActions = {
    [RegisterStep.onboarding]: () => setStep(RegisterStep.authorisation),
    [RegisterStep.authorisation]: onApprove,
    [RegisterStep.register]: onIndexerRegister,
    [RegisterStep.sync]: onSyncIndexer,
  };

  const renderSteps = () => {
    if (currentStep === RegisterStep.onboarding) return null;
    const currentIndex = getStepIndex(currentStep);
    return (
      <RegistrySteps current={currentIndex}>
        {registerSteps.map((title, i) => (
          <RegistrySteps.Step key={title} status={getStepStatus(currentIndex, i)} title={title} />
        ))}
      </RegistrySteps>
    );
  };

  if (isUndefined(initialStep) || isUndefined(isRegisterIndexer)) return <LoadingSpinner />;

  return (
    <Container>
      {renderSteps()}
      {currentStep && item && !isRegisterStep() && (
        // @ts-ignore
        <IntroductionView item={item} loading={loading} onClick={registerActions[currentStep]} />
      )}
      {currentStep && isRegisterStep() && (
        <IndexerRegistryView loading={loading} onSubmit={onIndexerRegister} />
      )}
    </Container>
  );
};

export default RegisterPage;
