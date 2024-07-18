// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { ID, Field, Int, ObjectType } from '@nestjs/graphql';
import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('config')
@Index(['key'], { unique: true })
@ObjectType()
export class ConfigEntity {
  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  @Field({ nullable: true })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  @Field({ nullable: true })
  updated_at: Date;

  @PrimaryGeneratedColumn('increment')
  @Field(() => ID, { nullable: true })
  id: number;

  @Column({ type: 'varchar' })
  @Field()
  key: string;

  @Column({ type: 'varchar', nullable: true, default: '' })
  @Field(() => String, { nullable: true })
  value: string | null;

  @Column({ type: 'int', nullable: true, default: 0 })
  @Field(() => Int, { nullable: true })
  sort: number;
}
