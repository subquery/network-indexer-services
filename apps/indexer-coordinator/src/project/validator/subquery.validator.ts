// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Project, ValidationResponse } from '../project.model';
import { getLogger } from 'src/utils/logger';
import axios from 'axios';
import path from 'path';
import { RpcManifest } from '../project.manifest';
import { validatePrivateEndpoint } from './common.validator';

const logger = getLogger('subquery.validator');

export async function validateNodeEndpoint(
  endpoint: string,
  project: Project
): Promise<ValidationResponse> {
  try {
    const validate = await validatePrivateEndpoint(endpoint);
    if (!validate.valid) {
      return validate;
    }

    const response = await axios.get(path.join(endpoint, 'meta'), {
      timeout: 5000,
    });
    if (response.status !== 200) {
      return { valid: false, reason: 'Invalid node endpoint' };
    }
    const data = response.data;
    const projectManifest = project.manifest as RpcManifest;

    if (data?.chain !== projectManifest.chain?.chainId) {
      return { valid: false, reason: 'Invalid chain' };
    }
    return { valid: true, reason: '' };
  } catch (error) {
    logger.error(error);
    return { valid: false, reason: error.message };
  }
}

export async function validateQueryEndpoint(
  endpoint: string,
  project: Project
): Promise<ValidationResponse> {
  try {
    const validate = await validatePrivateEndpoint(endpoint);
    if (!validate.valid) {
      return validate;
    }

    const response = await axios.request({
      url: path.join(endpoint, 'graphql'),
      method: 'POST',
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        query: `
        query {
          _metadata {
            chain
          }
        }
      `,
      },
    });
    if (response.status !== 200) {
      return { valid: false, reason: 'Invalid query endpoint' };
    }

    const data = response.data.data;
    const projectManifest = project.manifest as RpcManifest;

    if (data?.chain !== projectManifest.chain?.chainId) {
      return { valid: false, reason: 'Invalid chain' };
    }
    return { valid: true, reason: '' };
  } catch (error) {
    logger.error(error);
    return { valid: false, reason: error.message };
  }
}
