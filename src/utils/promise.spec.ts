// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import 'reflect-metadata';
import { mutexPromise } from './promise';

class T {
  constructor(private delay = 1000) {}
  @mutexPromise()
  async doPromise(): Promise<number> {
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log(this.delay);
        resolve(this.delay);
      }, this.delay);
    });
  }
}

describe('promise utils', () => {
  it('apply mutex lock to promise', async () => {
    const t = new T(2000);
    const t2 = new T(1000);
    const p: Promise<number>[] = [];
    p.push(t.doPromise());
    p.push(t2.doPromise());
    const v = await Promise.race(p);
    expect(v).toBe(2000);
    const p2: Promise<number>[] = [];
    p2.push(t.doPromise());
    p2.push(t2.doPromise());
    await expect(Promise.all(p)).resolves.toEqual([2000,1000]);
  });
});
