// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService, ConfigType } from 'src/config/config.service';
import { In, Repository } from 'typeorm';
import {  getLogger } from '../utils/logger';
import _ from 'lodash';
import {
  PaygEntity,
  Project,
  DominantPrice,
} from './project.model';
import axios from 'axios';
import { BigNumber } from 'ethers';

const CHS = 'http://192.168.1.141:8010/get_dominator_price';

@Injectable()
export class PriceService {
  private cache: Map<string, DominantPrice> = new Map();

  constructor(
    @InjectRepository(PaygEntity) private paygRepo: Repository<PaygEntity>,
    private configService: ConfigService
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async refreshPrice() {
    const dids = [...this.cache.keys()];
    await this.request(dids, true);
  }

  async fillPaygAndDominatePrice(projects: Project[]) {
    const deploymentIds = projects.map((p) => p.id);
    if (deploymentIds.length) {
      const [paygRes, priceRes] = await Promise.allSettled([
        this.paygRepo.find({
          where: { id: In(deploymentIds) },
        }),
        this.getDominatePrice(deploymentIds),
      ]);

      let paygs = [];
      if (paygRes.status === 'fulfilled') {
        paygs = paygRes.value;
      } else {
        getLogger('price').error(`fail to get paygs. reason:${paygRes.reason}`);
      }

      let prices = [];
      if (priceRes.status === 'fulfilled') {
        prices = priceRes.value;
      } else {
        getLogger('price').error(`fail to get prices. reason:${priceRes.reason}`);
      }

      const ratio = Number(await this.configService.get(ConfigType.FLEX_PRICE_RATIO));

      for (const p of projects) {
        p.payg = _.find(paygs, (payg: PaygEntity) => payg.id === p.id);
        p.dominantPrice = _.find(prices, (pri: DominantPrice) => pri.id === p.id);

        // no payg
        if (!p.payg) continue;

        // no dominant price
        if (!p.dominantPrice?.price) continue;

        const minPrice = BigNumber.from(p.payg.minPrice || 0);
        const dominant = BigNumber.from(p.dominantPrice.price).mul(ratio).div(100);
        p.payg.price = minPrice.gt(dominant) ? minPrice.toString() : dominant.toString();
      }
    }
  }

  async getDominatePrice(deploymentIds: string[]): Promise<DominantPrice[]> {
    const res = [];
    const nocacheIds = [];
    for (const did of deploymentIds) {
      const c = this.cache.get(did);
      if (c) {
        res.push(_.pick(c, ['id', 'price', 'lastError']));
        continue;
      }
      nocacheIds.push(did);
    }
    console.log('----nocacheIds--', nocacheIds);
    const rest = await this.request(nocacheIds, true);
    return res.concat(rest);
  }

  private async request(deploymentIds: string[], setCache: boolean) {
    const res = [];
    if (!deploymentIds.length) return res;
    try {
      const r = await axios.request({
        url: CHS,
        method: 'POST',
        data: {
          deployment_list: deploymentIds,
        },
        timeout: 1000 * 10,
      });
      if (r.data.error) {
        throw new Error(r.data.error);
      }
      for (const { deployment: id, price } of r.data) {
        const info = {
          id,
          price,
          retrieveCount: 1,
          failCount: 0,
        };
        if (setCache && price !== null) {
          this.cache.set(id, info);
        }
        res.push(_.pick(info, ['id', 'price', 'lastError']));
      }
    } catch (e) {
      // error. add reason
      for (const id of deploymentIds) {
        res.push({
          id,
          price: null,
          lastError: e.message,
        });
      }
    }
    return res;
  }
}
