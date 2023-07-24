// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

export enum RegisterStep {
  onboarding = 'onboarding',
  authorisation = 'authorisation',
  register = 'register',
  sync = 'sync',
}

export enum StepStatus {
  wait = 'wait',
  process = 'process',
  finish = 'finish',
}
