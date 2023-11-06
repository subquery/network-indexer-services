// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import dns from 'dns';
import { promisify } from 'util';

const lookup = promisify(dns.lookup);

export async function getIpAddress(domain: string): Promise<string> {
  const { address } = await lookup(domain);
  return address;
}

export function isIp(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  return parts.length === 4 && parts.every((part) => part >= 0 && part <= 255);
}

export function isPrivateIp(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  return (
    parts[0] === 10 || // 10.0.0.0 - 10.255.255.255
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || // 172.16.0.0 - 172.31.255.255
    (parts[0] === 192 && parts[1] === 168) // 192.168.0.0 - 192.168.255.255
  );
}

export function getDomain(url: string): string {
  const domain = new URL(url).hostname;
  return domain;
}
