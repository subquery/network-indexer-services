import { ContractSDK, SubqueryNetwork } from '@subql/contract-sdk';
import { Signer } from 'ethers';
import { localnet as deploymentDetails } from './localnet';

const contractSDKOptions = {
  network: 'local' as SubqueryNetwork,
  deploymentDetails,
};

export async function initContractSDK(provider: Signer): Promise<ContractSDK> {
  const sdk = await ContractSDK.create(provider, contractSDKOptions);
  return sdk;
}