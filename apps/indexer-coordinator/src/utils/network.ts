// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import dns from 'dns';
import { isIP } from 'net';
import { promisify } from 'util';
import { isPrivate } from 'ip';

const lookup = promisify(dns.lookup);

export async function getIpAddress(domain: string): Promise<string> {
  const { address } = await lookup(domain);
  return address;
}

export function isIp(ip: string): boolean {
  return isIP(ip) !== 0;
}

export function isPrivateIp(ip: string): boolean {
  return isPrivate(ip);
}

export function getDomain(url: string): string {
  const domain = new URL(url).hostname;
  return domain;
}
