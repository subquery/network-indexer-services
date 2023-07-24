// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Controller, Get, Post, Body } from '@nestjs/common';

class Proxy {
  // percentage of used cpu, eg. 25, means 25%
  p_cpu: number;
  // total memory size, unit is GB
  t_mem: number;
  // percentage of used memory
  p_mem: number;
  // total disk size, unit is GB
  t_disk: number;
  // percentage of used disk
  p_disk: number;
  // peer id in the p2p network
  peer: string;
  // peer address in the p2p network
  addr: string;
  // the number of actived agreements
  agreement: number;
  // the number of actived state channels
  channel: number;
}

@Controller('monitor')
export class MonitorController {
  proxies: Map<string, Proxy> = new Map();

  @Get()
  index() {
    return Array.from(this.proxies.values());
  }

  @Post()
  collect(@Body() proxy: Proxy) {
    this.proxies.set(proxy.peer, proxy);
    return;
  }
}
