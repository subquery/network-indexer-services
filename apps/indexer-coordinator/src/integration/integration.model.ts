// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { ID, Field, ObjectType } from '@nestjs/graphql';
import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SeviceEndpoint } from '../project/project.model';
import { IntegrationType } from '../project/types';

@Entity('integration')
@Index(['title'], { unique: true })
@ObjectType()
export class IntegrationEntity {
  @PrimaryGeneratedColumn('increment')
  @Field(() => ID, { nullable: true })
  id: number;

  @Column({ type: 'varchar', length: 50 })
  @Field()
  title: string;

  @Column()
  @Field()
  type: IntegrationType;

  @Column('jsonb', { default: {} })
  @Field(() => [SeviceEndpoint], { nullable: true })
  serviceEndpoints: SeviceEndpoint[];

  @Column({ type: 'boolean', default: false })
  @Field()
  enabled: boolean;

  @Column('jsonb', { default: {} })
  config: any;

  @Column('jsonb', { default: {} })
  extra: any;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  @Field({ nullable: true })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  @Field({ nullable: true })
  updated_at: Date;
}
