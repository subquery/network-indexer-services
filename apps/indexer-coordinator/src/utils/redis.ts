// Copyright 2020-2025 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { RedisClientType } from '@redis/client';
import { createClient } from 'redis';
import { argv } from 'src/yargs';

let redisClient: RedisClientType;

export async function getRedisClient(): Promise<RedisClientType> {
  if (!redisClient) {
    redisClient = createClient({
      url: argv['redis-url'],
    });
    await redisClient.connect();
  }
  return redisClient;
}

export async function redisSet(key: string, value: string, ttl = 0): Promise<string> {
  return (await getRedisClient()).set(key, value, { EX: ttl ? ttl : undefined });
}

export async function redisSetObj(key: string, value: any, ttl = 0): Promise<string> {
  return redisSet(key, JSON.stringify(value), ttl);
}

export async function redisGet(key: string): Promise<string | null> {
  return (await getRedisClient()).get(key);
}

export async function redisGetObj<T>(key: string): Promise<T | null> {
  const value = await redisGet(key);
  return value ? JSON.parse(value) : null;
}

export async function redisHas(key: string): Promise<boolean> {
  return (await (await getRedisClient()).exists(key)) === 1;
}

export async function redisDel(key: string): Promise<number> {
  return (await getRedisClient()).del(key);
}
