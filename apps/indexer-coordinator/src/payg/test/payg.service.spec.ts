// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Test, TestingModule } from '@nestjs/testing';
import { PaygService } from '../payg.service';

describe('PaygService', () => {
  let service: PaygService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PaygService],
    }).compile();

    service = module.get<PaygService>(PaygService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
