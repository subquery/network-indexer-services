// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Controller, Get, Param } from '@nestjs/common';
import { OnChainService } from './core/onchain.service';

@Controller('agreements')
export class AgreementController {
  constructor(private onChain: OnChainService) {}

  @Get(':id')
  async index(@Param('id') id: string) {
    const argeement = await this.onChain
      .getSdk()
      .serviceAgreementRegistry.getClosedServiceAgreement(id);
    return argeement;
  }
}
