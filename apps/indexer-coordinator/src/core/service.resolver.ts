// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Resolver, Query, Args } from '@nestjs/graphql';
import {getLogger} from "../utils/logger";
import {AccountService} from "./account.service";
import { ContractService } from './contract.service';

const logger = getLogger('ServiceResolver');

@Resolver()
export class ServiceResolver {
  constructor(
    private accountService: AccountService,
    private contract: ContractService
  ) {}

  @Query(() => Boolean)
  async withrawController(@Args('id') id: string) {
    const indexer = await this.accountService.getIndexer();
    const controller = await this.accountService.getController(id);
    if (!controller) {
      logger.warn(`Controller: ${id} not exist`);
      return;
    }
    return this.contract.withdrawAll(id, indexer, controller);
  }
}
