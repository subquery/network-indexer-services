// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { IPFS_URLS } from '@subql/network-config';
import { utils } from 'ethers';
import { create } from 'ipfs-http-client';

export const IPFS_PROJECT_CLIENT = create({ url: IPFS_URLS.metadata });
export const IPFS_METADATA_CLIENT = create({
  url: 'https://unauthipfs.subquery.network/ipfs/api/v0',
});

export function cidToBytes32(cid: string): string {
  return `0x${Buffer.from(utils.base58.decode(cid)).slice(2).toString('hex')}`;
}

export function bytes32ToCid(bytes: string): string {
  const hashHex = `1220${bytes.slice(2)}`;
  const hashBytes = Buffer.from(hashHex, 'hex');
  return utils.base58.encode(hashBytes);
}

export function concatU8A(a: Uint8Array, b: Uint8Array): Uint8Array {
  const res = new Uint8Array(a.length + b.length);
  res.set(a, 0);
  res.set(b, a.length);
  return res;
}

export async function createIndexerMetadata(
  name: string,
  url?: string,
  description?: string
): Promise<string> {
  const result = await IPFS_METADATA_CLIENT.add(JSON.stringify({ name, url, description }), {
    pin: true,
  });
  const cid = result.cid.toV0().toString();
  return cidToBytes32(cid);
}

export async function cat(cid: string, client = IPFS_METADATA_CLIENT) {
  const results = client.cat(cid);
  let raw: Uint8Array | undefined;

  // eslint-disable-next-line no-restricted-syntax
  for await (const result of results) {
    raw = raw ? concatU8A(raw, result) : result;
  }

  if (!raw) {
    console.error(`Unable to fetch data from ipfs: ${cid}`);
    return raw;
  }

  const result = Buffer.from(raw).toString('utf8');

  try {
    return JSON.parse(Buffer.from(raw).toString('utf8'));
  } catch {
    return result;
  }
}
