// Copyright 2020-2024 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { ID, Field, Int, ObjectType } from '@nestjs/graphql';
import { IntegrationType } from '../project/types';
import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SeviceEndpoint } from '../project/project.model';

@Entity('integration')
@ObjectType()
export class IntegrationEntity {
  @PrimaryGeneratedColumn('increment')
  @Field(() => ID, { nullable: true })
  id: number;

  @Column({ type: 'varchar' })
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
