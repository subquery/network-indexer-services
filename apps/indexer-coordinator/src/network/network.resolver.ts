// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Args, Resolver, Query } from '@nestjs/graphql';
import { NetworkService } from './network.service';
import { ProjectDetailsFromNetwork } from './network.type';

@Resolver()
export class NetworkResolver {
  constructor(private readonly networkService: NetworkService) {}

  @Query(() => String, { nullable: true })
  async getProjectTotalReward(@Args('id') id: string) {
    return (await this.networkService.getProjectByDeploymentId(id))?.totalReward?.toString();
  }

  @Query(() => ProjectDetailsFromNetwork, { nullable: true })
  async queryProjectDetailsFromNetwork(@Args('id') id: string) {
    return {
      id: id,
      totalReward: (
        await this.networkService.getProjectByDeploymentId(id)
      )?.totalReward?.toString(),
      indexerCount: (await this.networkService.getDeploymentIndexersById(id))?.totalCount,
      totalAgreement: (await this.networkService.getDeploymentAgreementsById(id))?.totalCount,
      totalOffer: (await this.networkService.getDeploymentOffersById(id))?.totalCount,
    };
  }
}
