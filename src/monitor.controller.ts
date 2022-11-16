// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Controller, Get, Post, Body } from '@nestjs/common';

class Proxy {
  p_cpu: number;
  t_mem: number;
  p_mem: number;
  t_disk: number;
  p_disk: number;
  peer: string;
  addr: string;
  agreement: number;
  channel: number;
}

@Controller('monitor')
export class MonitorController {
  proxies: Map<string, Proxy> = new Map();

  @Get()
  async index() {
    console.log('proxies: ', this.proxies);
    return this.proxies;
  }

  @Post()
  async collect(@Body() proxy: Proxy) {
    this.proxies.set(proxy.peer, proxy);
    return;
  }
}
