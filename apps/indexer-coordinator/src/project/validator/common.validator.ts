// Copyright 2020-2025 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { getDomain, getIpAddress, isIp, isPrivateIp } from 'src/utils/network';
import { getLogger } from '../../utils/logger';
import { ValidationResponse } from '../project.model';
import { ErrorLevel } from '../types';

const logger = getLogger('common.validator');

export async function validatePrivateEndpoint(endpoint: string): Promise<ValidationResponse> {
  try {
    const domain = getDomain(endpoint);
    if (!domain) {
      return { valid: false, reason: 'Invalid domain', level: ErrorLevel.error };
    }
    let ip: string;
    if (isIp(domain)) {
      ip = domain;
    } else {
      ip = await getIpAddress(domain);
    }
    if (!ip) {
      return { valid: false, reason: 'Invalid ip address', level: ErrorLevel.error };
    }
    if (!isPrivateIp(ip)) {
      return { valid: false, reason: 'Endpoint is not private ip', level: ErrorLevel.error };
    }
    return { valid: true, reason: '' };
  } catch (e) {
    logger.error(e);
    return { valid: false, reason: e.message, level: ErrorLevel.error };
  }
}
