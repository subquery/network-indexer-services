// Copyright 2020-2021 OnFinality Limited authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Injectable } from '@nestjs/common';
import { getLogger } from 'src/utils/logger';

@Injectable()
export class IPFSService {
  getData(cid: string) {
    // TODO: get all the data from cid
    return false;
  }
}
