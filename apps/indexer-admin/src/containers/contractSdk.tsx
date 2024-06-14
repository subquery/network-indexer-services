// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import { openNotification } from '@subql/components';
import { ContractSDK } from '@subql/contract-sdk/sdk';
import { SdkOptions } from '@subql/contract-sdk/types';
import { SQNetworks } from '@subql/network-config';
import { tipsChainIds } from 'conf/rainbowConf';
import { intToHex } from 'ethereumjs-util';
import { useNetwork } from 'wagmi';

import { useSignerOrProvider } from 'hooks/web3Hook';
import Logger from 'utils/logger';
import { ChainID } from 'utils/web3';

import { createContainer } from './unstated';

function createContractOptions(network: SQNetworks): SdkOptions {
  return {
    network,
  };
}

const options = {
  [ChainID.testnet]: createContractOptions(SQNetworks.TESTNET),
  [ChainID.mainnet]: createContractOptions(SQNetworks.MAINNET),
};

export type SDK = ContractSDK | undefined;

function useContractsImpl(logger: Logger): SDK {
  const [sdk, setSdk] = React.useState<ContractSDK>();
  const { chain } = useNetwork();
  const signerOrProvider = useSignerOrProvider();

  React.useEffect(() => {
    if (!chain?.id || !tipsChainIds.includes(chain.id)) return;

    const sdkOption = options[intToHex(chain.id) as ChainID];

    if (!sdkOption || !sdkOption.network) {
      openNotification({
        type: 'error',
        description:
          'Invalid sdk options, please upgrade to latest version or let us know in discord.',
      });
      throw new Error(
        'Invalid sdk options, contracts provider requires network and deploymentDetails'
      );
    }

    if (signerOrProvider) {
      setSdk(ContractSDK.create(signerOrProvider, sdkOption));
    }
  }, [logger, signerOrProvider, chain]);

  return sdk;
}

export const { useContainer: useContractSDK, Provider: ContractSDKProvider } = createContainer(
  useContractsImpl,
  {
    displayName: 'Contract SDK',
  }
);
