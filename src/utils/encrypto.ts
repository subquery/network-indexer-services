// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { randomBytes, createDecipheriv, createCipheriv } from 'crypto';
import { isEmpty } from 'lodash';

const algorithm = 'aes-256-ctr';
const iv = randomBytes(16);

export const secretKey = 'vOVH6sdmpNWjRRIqCc7rdxs01lwHzfr3';

export function encrypt(value: string, key = secretKey): string {
  const cipher = createCipheriv(algorithm, key, iv);
  const encrypted = Buffer.concat([cipher.update(value), cipher.final()]);
  return JSON.stringify({
    iv: iv.toString('hex'),
    content: encrypted.toString('hex'),
  });
}

export function decrypt(value: string, key = secretKey): string {
  if (isEmpty(value)) return value;
  const hash = JSON.parse(value);
  const decipher = createDecipheriv(algorithm, key, Buffer.from(hash.iv, 'hex'));
  const decrpyted = Buffer.concat([
    decipher.update(Buffer.from(hash.content, 'hex')),
    decipher.final(),
  ]);

  return decrpyted.toString();
}
