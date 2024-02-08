// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Controller, Get, Param } from '@nestjs/common';
import { ContractService } from './core/contract.service';

@Controller('agreements')
export class AgreementController {
  constructor(private contract: ContractService) {}

  @Get(':id')
  async index(@Param('id') id: string) {
    const argeement = await this.contract
      .getSdk()
      .serviceAgreementRegistry.getClosedServiceAgreement(id);
    return argeement;
  }
}
