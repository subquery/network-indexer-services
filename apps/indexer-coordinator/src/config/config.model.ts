// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

export class ConfigEntity {
  key: ConfigKey;
  value: string;
  title: string;
  unit: string;
  description: string;
}

export enum ConfigKey {
  AllocationRewardThreshold = 'AllocationRewardThreshold',
  StateChannelRewardThreshold = 'StateChannelRewardThreshold',
}

export const defaultConfig: ConfigEntity[] = [
  {
    key: ConfigKey.AllocationRewardThreshold,
    value: '2000',
    title: 'Allocation Reward Threshold',
    unit: 'SQT',
    description: 'The minimum amount of SQT to be collected for allocation rewards',
  },
  {
    key: ConfigKey.StateChannelRewardThreshold,
    value: '2000',
    title: 'State Channel Reward Threshold',
    unit: 'SQT',
    description: 'The minimum amount of SQT to be collected for state channel rewards',
  },
];
