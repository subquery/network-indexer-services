// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { providers } from 'ethers';

export interface MultipleEndpointProviderOptions {
  endpoints: string | Array<string>;
  chainID: string;
}

export class MultipleEndpointProvider extends providers.StaticJsonRpcProvider {
  endpoints: Array<string>;

  constructor(options: MultipleEndpointProviderOptions) {
    const endpoints = Array.isArray(options.endpoints) ? options.endpoints : [options.endpoints];
    super(endpoints[0], parseInt(options.chainID, 16));
    this.endpoints = endpoints;
  }

  override send(method: string, params: Array<any>): Promise<any> {
    // @ts-ignore
    const i = this.count || 0;
    const len = this.endpoints.length;

    const obj = Object.create(this, {
      connection: {
        value: this.endpoints[i],
      },
      count: {
        value: i,
      },
    });

    return super.send
      .call(obj, method, params)
      .then(
        (result) => {
          return result;
        },
        (err) => {
          if (i >= len) throw err;
          obj.count++;
          return this.send.call(obj, method, params);
        }
      )
      .catch((err) => {
        if (i >= len) throw err;
        obj.count++;
        return this.send.call(obj, method, params);
      });
  }
}
