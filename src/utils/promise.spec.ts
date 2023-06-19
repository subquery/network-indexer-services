// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import 'reflect-metadata';
import { mutexPromise } from './promise';

class T {
  constructor(private delay = 1000, private counter=0) {}
  @mutexPromise()
  async doPromise(input: number): Promise<number> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        console.log(input);
        if (this.counter++ === 2) {
          reject(new Error());
        }else {
          resolve(input);
        }
      }, this.delay);
    });
  }
}

describe('promise utils', () => {
  it('apply mutex lock to promise', async () => {
    const t = new T(200);
    const t2 = new T(100);
    const p: Promise<number>[] = [];
    p.push(t.doPromise(200));
    p.push(t2.doPromise(100));
    const v = await Promise.race(p);
    expect(v).toBe(200);
    const p2: Promise<number>[] = [];
    p2.push(t.doPromise(200));
    p2.push(t2.doPromise(100));
    await expect(Promise.all(p2)).resolves.toEqual([200,100]);
  });
  it('continue when one of promise is error', async () => {
    const t = new T(100);
    const p: Promise<number>[] = [];
    p.push(t.doPromise(1));
    p.push(t.doPromise(2));
    p.push(t.doPromise(3).catch(e=>-1));
    p.push(t.doPromise(4));
    await expect(Promise.all(p)).resolves.toEqual([1,2,-1,4]);
  });
});
