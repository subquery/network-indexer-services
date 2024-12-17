// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { providers } from 'ethers';

function mask(endpoint: string) {
  const len = endpoint.length;
  const toMaskLen = Math.min(8, len - 2);
  if (toMaskLen <= 0) return endpoint;
  return `${endpoint.slice(0, len - toMaskLen)}${'*'.repeat(toMaskLen)}`;
}
export interface MultipleEndpointProviderOptions {
  endpoints: string | Array<string>;
  chainID: string;
  logger?: any;
}

export class MultipleEndpointProvider extends providers.StaticJsonRpcProvider {
  endpoints: Array<string>;
  logger?: any;

  constructor(options: MultipleEndpointProviderOptions) {
    const endpoints = Array.isArray(options.endpoints) ? options.endpoints : [options.endpoints];
    super(endpoints[0], parseInt(options.chainID, 16));
    this.endpoints = endpoints;
    this.logger = options.logger;
  }

  override send(method: string, params: Array<any>): Promise<any> {
    // @ts-ignore
    const i = this.count || 0;
    const len = this.endpoints.length - 1;
    const endpoint = this.endpoints[i];

    let obj = this;

    if (obj[Symbol.toStringTag] !== 'extend-multi') {
      obj = Object.create(this, {
        [Symbol.toStringTag]: {
          value: 'extend-multi',
        },
      });
    }

    Object.defineProperties(obj, {
      connection: {
        value: {
          url: endpoint,
        },
        writable: true,
        configurable: true,
      },
      count: {
        value: i,
        writable: true,
        configurable: true,
      },
    });

    return super.send.call(obj, method, params).then(
      (result) => {
        return result;
      },
      (err) => {
        const cut = i >= len;
        this.logger?.warn(
          `rpc(${i}/${len} ${mask(endpoint)}) errored. ${err}. ${
            cut ? 'throw' : 'will retry with next endpoint...'
          }`
        );

        if (cut) throw err;
        // @ts-ignore
        obj.count++;
        return this.send.call(obj, method, params);
      }
    );
    // .catch((err) => {
    // if (i >= len) throw err;
    // obj.count++;
    // this.logger?.warn(
    //   `rpc(catch ${i} ${mask(endpoint)}) errored: ${err}. will retry with next endpoint...`
    // );
    // return this.send.call(obj, method, params);
    // });
  }
}
