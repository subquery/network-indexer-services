// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useMemo, useState } from 'react';
import { isUndefined } from 'lodash';

import { useAccount } from 'containers/account';
import { useContractSDK } from 'containers/contractSdk';
import { RegisterStep } from 'pages/register/types';

export const useIsApproved = () => {
  const [isApprove, setIsApprove] = useState<boolean>();
  const { account } = useAccount();
  const sdk = useContractSDK();

  const checkAllowance = useCallback(async () => {
    if (!account || !sdk) return;
    try {
      const mimAmount = (await sdk.indexerRegistry.minimumStakingAmount()) ?? 1000;
      const amount = await sdk.sqToken.allowance(account, sdk.staking.address);
      setIsApprove(!!amount.gte(mimAmount));
    } catch {
      setIsApprove(false);
    }
  }, [sdk, account]);

  useEffect(() => {
    checkAllowance();
  }, [checkAllowance]);

  return isApprove;
};

export const useInitialStep = (): RegisterStep | undefined => {
  const isApproved = useIsApproved();

  return useMemo(() => {
    if (isUndefined(isApproved)) return undefined;
    if (isApproved) return RegisterStep.register;
    return RegisterStep.onboarding;
  }, [isApproved]);
};
