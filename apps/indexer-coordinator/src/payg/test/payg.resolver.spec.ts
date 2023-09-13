// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Test, TestingModule } from '@nestjs/testing';
import { PaygResolver } from '../payg.resolver';

describe('PaygResolver', () => {
  let resolver: PaygResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PaygResolver],
    }).compile();

    resolver = module.get<PaygResolver>(PaygResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
