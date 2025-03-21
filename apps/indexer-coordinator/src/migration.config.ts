// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { DataSource } from 'typeorm';
import { dbOption } from './data-source';

const datasource = new DataSource(dbOption); // config is one that is defined in datasource.config.ts file
datasource.initialize();

export default datasource;
