// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { URL } from 'url';
import axios from 'axios';
import { getLogger } from '../../utils/logger';
import { SubqueryManifest } from '../project.manifest';
import { Project, ValidationResponse } from '../project.model';
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
    const url = new URL('meta', endpoint);
    const response = await axios.get(url.toString(), {
      timeout: 5000,
    });
    if (response.status !== 200) {
      return { valid: false, reason: 'Invalid node endpoint. HTTP status should be 200' };
    }
    const data = response.data;
    const projectManifest = project.manifest as SubqueryManifest;

    if (data?.genesisHash !== projectManifest.network?.chainId) {
      logger.error(
        `Invalid node endpoint chain. genesisHash:${data.genesisHash}, chainId:${projectManifest.network?.chainId}`
      );
      return { valid: false, reason: 'Invalid node endpoint chain' };
    }
    return { valid: true, reason: '' };
  } catch (error) {
    logger.error(`Failed to validate node endpoint: ${error.message}`);
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
    const url = new URL('graphql', endpoint);
    const response = await axios.request({
      url: url.toString(),
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
            genesisHash
          }
        }
      `,
      },
    });
    if (response.status !== 200) {
      return { valid: false, reason: 'Invalid query endpoint. HTTP status should be 200' };
    }

    const data = response.data.data;
    const projectManifest = project.manifest as SubqueryManifest;

    console.log('data:', data);
    if (data?._metadata?.genesisHash !== projectManifest.network?.chainId) {
      logger.error(
        `Invalid query endpoint chain. genesisHash:${data?._metadata?.genesisHash}, chainId:${projectManifest.network?.chainId}`
      );
      return { valid: false, reason: 'Invalid query endpoint chain' };
    }
    return { valid: true, reason: '' };
  } catch (error) {
    logger.error(`Failed to validate query endpoint: ${error.message}`);
    return { valid: false, reason: error.message };
  }
}
