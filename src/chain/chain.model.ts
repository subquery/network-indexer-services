// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class Chain {
  @PrimaryColumn()
  name: string;

  @Column()
  value: string;
}
