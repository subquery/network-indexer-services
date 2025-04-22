// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { BigNumber } from 'ethers';
import _ from 'lodash';
import { ConfigService, ConfigType } from 'src/config/config.service';
import { ContractService } from 'src/core/contract.service';
import { argv } from 'src/yargs';
import { In, Repository } from 'typeorm';
import { getLogger } from '../utils/logger';
import { PaygEntity, Project, DominantPrice, Payg } from './project.model';

const CHS = argv['chs-endpoint'];

@Injectable()
export class PriceService {
  private cache: Map<string, DominantPrice> = new Map();

  constructor(
    @InjectRepository(PaygEntity) private paygRepo: Repository<PaygEntity>,
    private configService: ConfigService,
    private contract: ContractService
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async refreshPrice() {
    const dids = [...this.cache.keys()];
    await this.request(dids, true);
  }

  async inlinePayg(paygs: Payg[], remoteExchangeRate?: string, trim: boolean = true) {
    const deploymentIds = paygs.map((p) => p.id);
    if (!deploymentIds.length) return;
    const dPrices = await this.getDominatePrice(deploymentIds);
    const defaultFlex = await this.configService.getFlexConfig();
    const [USDC_TOKEN, USDC_DECIMAL] = this.configService.getUSDC();
    const ONE_USDC = BigNumber.from(10).pow(USDC_DECIMAL).toString();

    let effectiveExchangeRate = '';

    for (const p of paygs) {
      p.minPrice = p.price;

      const exist = _.find(dPrices, (dp: DominantPrice) => dp.id === p.id);

      if (p.useDefault) {
        p.price = defaultFlex[ConfigType.FLEX_PRICE];
        p.minPrice = defaultFlex[ConfigType.FLEX_PRICE];
        p.priceRatio = Number(defaultFlex[ConfigType.FLEX_PRICE_RATIO]);
        p.token = defaultFlex[ConfigType.FLEX_TOKEN_ADDRESS];
      }

      if (p.token === USDC_TOKEN) {
        if (!effectiveExchangeRate) {
          const res = await this.checkEffectiveExchangeRate(
            remoteExchangeRate,
            ONE_USDC,
            defaultFlex
          );
          if (res.error) {
            p.error = `payg: ${res.error}`;
          } else {
            effectiveExchangeRate = res.data;
          }
        }
      }

      if (exist && exist.price !== null) {
        p.dominantPrice = exist.price;
        p.priceRatio =
          p.priceRatio !== null ? p.priceRatio : Number(defaultFlex[ConfigType.FLEX_PRICE_RATIO]);

        if (exist.token === USDC_TOKEN) {
          p.rawdominantToken = USDC_TOKEN;

          if (!effectiveExchangeRate) {
            const res = await this.checkEffectiveExchangeRate(
              remoteExchangeRate,
              ONE_USDC,
              defaultFlex
            );
            if (res.error) {
              p.error = `dominant: ${res.error}`;
            } else {
              effectiveExchangeRate = res.data;
            }
          }
        }
      }
    }

    effectiveExchangeRate = effectiveExchangeRate || remoteExchangeRate;

    for (const p of paygs) {
      p.exchangeRate = effectiveExchangeRate;
      if (p.token === USDC_TOKEN) {
        if (!p.exchangeRate) {
          getLogger('price').error(`${p.id} fail to get payg exchange rate from usdc. ${p.error}`);
          continue;
        }
        p.rawpaygMinPrice = p.price;
        p.rawpaygToken = p.token;

        p.price = BigNumber.from(effectiveExchangeRate).mul(p.price).div(ONE_USDC).toString();
        p.minPrice = p.price;
        p.token = this.contract.getSdk().sqToken.address;
      }

      if (!p.dominantPrice) continue;

      if (p.rawdominantToken === USDC_TOKEN) {
        if (!p.exchangeRate) {
          getLogger('price').error(
            `${p.id} fail to get dominant price exchange rate for usdc. ${p.error}`
          );
          continue;
        }
        p.rawdominantPrice = p.dominantPrice;

        p.dominantPrice = BigNumber.from(effectiveExchangeRate)
          .mul(p.dominantPrice)
          .div(ONE_USDC)
          .toString();
      }

      const minPrice = BigNumber.from(p.price || 0);
      const dominant = BigNumber.from(p.dominantPrice).mul(p.priceRatio).div(100);

      p.price = minPrice.gt(dominant) ? minPrice.toString() : dominant.toString();
    }

    if (trim) {
      _.remove(paygs, function (p) {
        return !p.exchangeRate && (p.token === USDC_TOKEN || p.rawdominantToken === USDC_TOKEN);
      });
    }
  }

  // eslint-disable-next-line complexity
  async fillPaygAndDominatePrice(projects: Project[], convert: boolean = false) {
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

      const defaultFlex = await this.configService.getFlexConfig();

      const [USDC_TOKEN, USDC_DECIMAL] = this.configService.getUSDC();
      const ONE_USDC = BigNumber.from(10).pow(USDC_DECIMAL).toString();
      const SQT_TOKEN = this.contract.getSdk().sqToken.address;

      let exchangeRate = '';

      for (const p of projects) {
        p.payg = _.find(paygs, (payg: PaygEntity) => payg.id === p.id);
        p.dominantPrice = _.find(prices, (pri: DominantPrice) => pri.id === p.id);

        // no payg
        if (!p.payg) continue;

        if (p.payg.useDefault) {
          p.payg.price = defaultFlex[ConfigType.FLEX_PRICE];
          p.payg.minPrice = defaultFlex[ConfigType.FLEX_PRICE];
          p.payg.priceRatio = Number(defaultFlex[ConfigType.FLEX_PRICE_RATIO]);
          p.payg.token = defaultFlex[ConfigType.FLEX_TOKEN_ADDRESS];
        } else {
          p.payg.minPrice = p.payg.price;
          p.payg.priceRatio =
            p.payg.priceRatio !== null
              ? p.payg.priceRatio
              : Number(defaultFlex[ConfigType.FLEX_PRICE_RATIO]);
        }

        if (convert && p.payg.token === USDC_TOKEN) {
          if (!exchangeRate) {
            const transferRes = await this.contract.convertFromUSDC(ONE_USDC);
            if (transferRes.error) {
              p.payg.error = transferRes.error;
            } else {
              exchangeRate = transferRes.data;
            }
          }
        }

        // no dominant price
        if (!p.dominantPrice?.price) {
          continue;
        }

        if (convert && p.dominantPrice.token === USDC_TOKEN) {
          if (!exchangeRate) {
            const transferRes = await this.contract.convertFromUSDC(ONE_USDC);
            if (transferRes.error) {
              p.payg.error = transferRes.error;
            } else {
              exchangeRate = transferRes.data;
            }
          }
        }
      }

      if (!exchangeRate) return;

      for (const p of projects) {
        if (convert && p.payg.token === USDC_TOKEN) {
          p.payg.error = null;
          p.payg.rawpaygMinPrice = p.payg.price;
          p.payg.rawpaygToken = p.payg.token;

          p.payg.price = BigNumber.from(exchangeRate).mul(p.payg.price).div(ONE_USDC).toString();
          p.payg.minPrice = p.payg.price;
          p.payg.token = SQT_TOKEN;
          p.payg.exchangeRate = exchangeRate;
        }

        if (!p.dominantPrice?.price) {
          continue;
        }

        if (convert && p.dominantPrice?.token === USDC_TOKEN) {
          p.payg.error = null;
          p.dominantPrice.rawToken = p.dominantPrice.token;
          p.dominantPrice.rawPrice = p.dominantPrice.price;

          p.dominantPrice.token = SQT_TOKEN;
          p.dominantPrice.price = BigNumber.from(exchangeRate)
            .mul(p.dominantPrice.price)
            .div(ONE_USDC)
            .toString();
        }

        if (convert) {
          const minPrice = BigNumber.from(p.payg.price || 0);
          const dominant = BigNumber.from(p.dominantPrice.price).mul(p.payg.priceRatio).div(100);
          p.payg.price = minPrice.gt(dominant) ? minPrice.toString() : dominant.toString();
        }
      }
    }
  }

  private async checkEffectiveExchangeRate(
    remoteExchangeRate: string,
    ONE_USDC: string,
    defaultFlex: Record<string, string>
  ): Promise<{ error?: string; data?: string }> {
    const transferRes = await this.contract.convertFromUSDC(ONE_USDC);
    if (transferRes.error) {
      // p.error = transferRes.error;
      return { error: transferRes.error };
    } else {
      const curChainExchangeRateBig = BigNumber.from(transferRes.data);

      if (!remoteExchangeRate) {
        return { data: curChainExchangeRateBig.toString() };
      }

      const slippage = Number(defaultFlex[ConfigType.FLEX_SLIPPAGE]);
      const rerBig = BigNumber.from(remoteExchangeRate);

      let smaller = rerBig;
      let bigger = curChainExchangeRateBig;

      if (smaller.gte(bigger)) {
        smaller = curChainExchangeRateBig;
        bigger = rerBig;
      }

      const upperbound = BigNumber.from(smaller)
        .mul(100 + slippage)
        .div(100);

      const effectiveExchangeRate = bigger.lte(upperbound)
        ? remoteExchangeRate
        : curChainExchangeRateBig.toString();

      return { data: effectiveExchangeRate };
    }
  }

  private async getDominatePrice(deploymentIds: string[]): Promise<DominantPrice[]> {
    const res = [];
    const nocacheIds = [];
    for (const did of deploymentIds) {
      const c = this.cache.get(did);
      if (c) {
        res.push(_.pick(c, ['id', 'price', 'token', 'lastError']));
        continue;
      }
      nocacheIds.push(did);
    }
    getLogger('price').debug(`nocacheIds: ${nocacheIds}`);
    const rest = await this.request(nocacheIds, true);
    return res.concat(rest);
  }

  private async request(deploymentIds: string[], setCache: boolean) {
    const res = [];
    if (!deploymentIds.length) return res;
    try {
      const url = new URL('/price/get_dominant_price', CHS).toString();
      const r = await axios.request({
        url,
        method: 'POST',
        data: {
          deployment_list: deploymentIds,
        },
        timeout: 1000 * 10,
      });
      if (r.data.error) {
        throw new Error(r.data.error);
      }
      for (const { deployment: id, price, token_address: token } of r.data) {
        const info = {
          id,
          price,
          token,
          retrieveCount: 1,
          failCount: 0,
        };
        if (setCache && price !== null) {
          this.cache.set(id, info);
        }
        res.push(_.pick(info, ['id', 'price', 'token', 'lastError']));
      }
    } catch (e) {
      getLogger('price').error(`fail to request price, error: ${e.message}`);
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
