// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { RegisterStep, StepStatus } from './types';

export const registerSteps = Object.entries(RegisterStep)
  .map(([key]) => key)
  .slice(1);

export const getStepIndex = (step?: RegisterStep): number =>
  registerSteps.findIndex((s) => s === step);

export const getStepStatus = (currentIndex: number, index: number): StepStatus => {
  if (currentIndex === index) return StepStatus.process;
  if (currentIndex > index) return StepStatus.finish;
  return StepStatus.wait;
};
