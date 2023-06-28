// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Controller, Get, Param } from '@nestjs/common';
import { NetworkService } from './core/network.service';

@Controller('agreements')
export class AgreementController {
  constructor(private network: NetworkService) {}

  @Get(':id')
  async index(@Param('id') id: string) {
    const argeement = await this.network.getSdk().serviceAgreementRegistry.getClosedServiceAgreement(id);
    return argeement;
  }
}
