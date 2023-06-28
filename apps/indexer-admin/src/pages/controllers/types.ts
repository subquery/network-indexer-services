// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

export type Controller = {
  id: string;
  address: string;
};

export enum ControllerAction {
  configController = 'configController',
  removeAccount = 'removeAccount',
  withdraw = 'widthdraw',
}
