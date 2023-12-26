// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
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

export function timeoutPromise(ms: number) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const origin = descriptor.value;
    descriptor.value = async function (...args) {
      return Promise.race([
        origin.bind(this)(...args),
        new Promise((resolve, reject) =>
          setTimeout(() => reject(new Error(`${propertyKey} timeout: ${ms}ms`)), ms)
        ),
      ]);
    };
  };
}

export function timeoutPromiseCatched(ms: number, defaultValue: any) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const origin = descriptor.value;
    descriptor.value = async function (...args) {
      try {
        return await Promise.race([
          origin.bind(this)(...args),
          new Promise((resolve, reject) =>
            setTimeout(() => reject(new Error(`${propertyKey} timeout: ${ms}ms`)), ms)
          ),
        ]);
      } catch (e) {
        return defaultValue;
      }
    };
  };
}

export function timeoutPromiseHO(ms: number) {
  return function (functionPromise: Promise<any>) {
    return Promise.race([
      functionPromise,
      new Promise((resolve, reject) => setTimeout(() => reject(new Error(`timeout: ${ms}ms`)), ms)),
    ]);
  };
}

export function timeoutPromiseCatchedHO(ms: number, defaultValue: any) {
  return function (functionPromise: Promise<any>) {
    try {
      return Promise.race([
        functionPromise,
        new Promise((resolve, reject) =>
          setTimeout(() => reject(new Error(`timeout: ${ms}ms`)), ms)
        ),
      ]);
    } catch (e) {
      return defaultValue;
    }
  };
}
