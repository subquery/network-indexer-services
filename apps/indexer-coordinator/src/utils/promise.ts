// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

const PROMISES = {};
/* eslint-disable */
export function mutexPromise() {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const lock = `${target.constructor.name}#${propertyKey}`;

    const origin = descriptor.value;
    descriptor.value = async function (...args) {
      const runOrigin = () => origin.bind(this)(...args);
      if (!PROMISES[lock]) {
        PROMISES[lock] = runOrigin();
      } else {
        PROMISES[lock] = PROMISES[lock].then(runOrigin, runOrigin);
      }
      return PROMISES[lock];
    };
  };
}
