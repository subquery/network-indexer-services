// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Test, TestingModule } from '@nestjs/testing';
import { NetworkResolver } from './network.resolver';

describe('NetworkResolver', () => {
  let resolver: NetworkResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NetworkResolver],
    }).compile();

    resolver = module.get<NetworkResolver>(NetworkResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
