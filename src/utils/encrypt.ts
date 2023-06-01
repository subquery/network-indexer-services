// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Buffer } from 'buffer';
import { randomBytes, createDecipheriv, createCipheriv, createHash } from 'crypto';

const algorithm = 'aes-256-gcm';
const iv = randomBytes(12);

export function encrypt(value: string, secretKey: string): string {
  const key = createHash('sha256').update(secretKey).digest('hex');
  const keyBuffer = Buffer.from(key, 'hex');
  const cipher = createCipheriv(algorithm, keyBuffer, iv);

  const encrypted = Buffer.concat([cipher.update(value), cipher.final(), cipher.getAuthTag(), iv]);
  return encrypted.toString('hex');
}

export function decrypt(value: string, secretKey: string): string {
  try {
    const key = createHash('sha256').update(secretKey).digest('hex');
    const keyBuffer = Buffer.from(key, 'hex');
    const ctext = Buffer.from(value, 'hex');
    const iv = ctext.slice(-12);
    const tag = ctext.slice(-28, -12);
    const content = ctext.slice(0, -28);
    const decipher = createDecipheriv(algorithm, keyBuffer, iv);
    decipher.setAuthTag(tag);
    const decrpyted = Buffer.concat([decipher.update(content), decipher.final()]);
    return decrpyted.toString();
  } catch (e) {
    return '';
  }
}
