// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { gql } from '@apollo/client/core';
import { Injectable } from '@nestjs/common';
import { GraphqlQueryClient } from '@subql/network-clients';
import { NETWORK_CONFIGS } from '@subql/network-config';
import {
  GetAllOpenOffersQuery,
  GetDeployment,
  GetDeploymentIndexers,
  GetDeploymentIndexersQuery,
  GetProject,
  GetProjectOngoingServiceAgreements,
  GetProjectOngoingServiceAgreementsQuery,
  GetProjectQuery,
} from '@subql/network-query';
import LRUCache from 'lru-cache';
import { Config } from '../configure/configure.module';
import { IndexerAllocationSummary } from './network.type';

@Injectable()
export class NetworkService {
  private cache: LRUCache<string, string>;
  private client: GraphqlQueryClient;

  constructor(config: Config) {
    this.cache = new LRUCache<string, string>({
      maxSize: 1000,
      sizeCalculation: () => 1,
    });
    this.client = new GraphqlQueryClient(NETWORK_CONFIGS[config.network]);
  }

  async getProjectByDeploymentId(id: string): Promise<GetProjectQuery['project']> {
    const cacheKey = `${this.getProjectByDeploymentId.name}:${id}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    const result = await this.client.networkClient.query({
      // @ts-ignore
      query: GetDeployment,
      variables: { deploymentId: id },
    });
    if (!result.data.deployment?.project) {
      return null;
    }
    const project = await this.getProjectById(result.data.deployment.project.id);
    if (project) {
      this.cache.set(cacheKey, JSON.stringify(project), { ttl: 30 * 60 * 1000 });
    }
    return project;
  }

  async getProjectById(id: string): Promise<GetProjectQuery['project']> {
    const cacheKey = `${this.getProjectById.name}:${id}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    const result = await this.client.networkClient.query({
      // @ts-ignore
      query: GetProject,
      variables: { id },
    });
    if (result?.data?.project) {
      this.cache.set(cacheKey, JSON.stringify(result.data.project), { ttl: 30 * 60 * 1000 });
    }
    return result?.data?.project as GetProjectQuery['project'];
  }

  async getDeploymentIndexersById(
    id: string
  ): Promise<GetDeploymentIndexersQuery['indexerDeployments']> {
    const cacheKey = `${this.getDeploymentIndexersById.name}:${id}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    const result = await this.client.networkClient.query({
      // @ts-ignore
      query: GetDeploymentIndexers,
      variables: { deploymentId: id, offset: 0 },
    });
    if (result?.data?.indexerDeployments) {
      this.cache.set(cacheKey, JSON.stringify(result.data.indexerDeployments), {
        ttl: 30 * 60 * 1000,
      });
    }
    return result?.data?.indexerDeployments as GetDeploymentIndexersQuery['indexerDeployments'];
  }

  async getDeploymentAgreementsById(
    id: string
  ): Promise<GetProjectOngoingServiceAgreementsQuery['serviceAgreements']> {
    const cacheKey = `${this.getDeploymentAgreementsById.name}:${id}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    const result = await this.client.networkClient.query({
      // @ts-ignore
      query: GetProjectOngoingServiceAgreements,
      variables: { deploymentId: id, now: new Date() },
    });
    if (result?.data?.serviceAgreements) {
      this.cache.set(cacheKey, JSON.stringify(result.data.serviceAgreements), {
        ttl: 30 * 60 * 1000,
      });
    }
    return result?.data
      ?.serviceAgreements as GetProjectOngoingServiceAgreementsQuery['serviceAgreements'];
  }

  async getDeploymentOffersById(id: string): Promise<GetAllOpenOffersQuery['offers']> {
    const cacheKey = `${this.getDeploymentOffersById.name}:${id}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    const result = await this.client.networkClient.query({
      query: gql`
        query GetDeploymentOffers(
          $deploymentId: String!
          $now: Datetime!
          $offset: Int
          $reachLimit: Boolean = false
        ) {
          offers(
            filter: {
              deploymentId: { equalTo: $deploymentId }
              expireDate: { greaterThan: $now }
              reachLimit: { equalTo: $reachLimit }
            }
            first: 10
            offset: $offset
          ) {
            totalCount
            nodes {
              id
            }
          }
        }
      `,
      variables: { deploymentId: id, now: new Date() },
    });
    if (result?.data?.offers) {
      this.cache.set(cacheKey, JSON.stringify(result.data.offers), {
        ttl: 30 * 60 * 1000,
      });
    }
    return result?.data?.offers as GetAllOpenOffersQuery['offers'];
  }

  async getIndexerAllocationSummaries(indexerId: string): Promise<IndexerAllocationSummary[]> {
    const cacheKey = `${this.getIndexerAllocationSummaries.name}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    const result = await this.client.networkClient.query({
      query: gql`
        query GetIndexerAllocationSummaries($indexerId: String!) {
          indexerAllocationSummaries(
            filter: { indexerId: { equalTo: $indexerId }, totalAmount: { greaterThan: "0" } }
          ) {
            totalCount
            nodes {
              deploymentId
            }
          }
        }
      `,
      variables: { indexerId },
    });
    if (result?.data?.deployments) {
      this.cache.set(cacheKey, JSON.stringify(result.data.deployments), {
        ttl: 30 * 60 * 1000,
      });
    }
    return result?.data?.indexerAllocationSummaries?.nodes as IndexerAllocationSummary[];
  }
}
