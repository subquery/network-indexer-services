// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNetwork } from 'wagmi';
import { base, baseSepolia } from 'wagmi/chains';

import { useAccount } from 'containers/account';
import { useContractSDK } from 'containers/contractSdk';

export const useTokenSymbol = () => {
  const { chain } = useNetwork();
  const tokenSymbol = useMemo(() => {
    if (chain?.id === baseSepolia.id) {
      return baseSepolia.nativeCurrency.symbol;
    }
    if (chain?.id === base.id) {
      return base.nativeCurrency.symbol;
    }

    return base.nativeCurrency.symbol;
  }, [chain]);

  return tokenSymbol;
};

export type IndexerEra = {
  currentEra: string;
  lastClaimedEra: string;
  lastSettledEra: string;
};

export const useIndexerEra = () => {
  const { account } = useAccount();
  const sdk = useContractSDK();

  const [indexerEra, setIndexerEra] = useState<IndexerEra>();

  const updateEra = useCallback(async () => {
    if (!sdk || !account) return;

    console.log('account:', account);
    const lastClaimedEra = (await sdk.rewardsDistributor.getRewardInfo(account)).lastClaimEra;
    const [currentEra, lastSettledEra] = await Promise.all([
      sdk.eraManager.eraNumber(),
      sdk.rewardsStaking.getLastSettledEra(account),
    ]);

    setIndexerEra({
      currentEra: currentEra.toString(),
      lastClaimedEra: lastClaimedEra.toString(),
      lastSettledEra: lastSettledEra.toString(),
    });
  }, [sdk, account]);

  useEffect(() => {
    updateEra();
  }, [updateEra]);

  return indexerEra;
};
