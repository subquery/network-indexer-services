// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class Project {
  @PrimaryColumn()
  id: string; // deploymentId

  @Column()
  status: number;

  @Column()
  networkEndpoint: string;

  @Column()
  nodeEndpoint: string; // endpoint of indexer service

  @Column()
  queryEndpoint: string; // endpoint of query service
}

@ObjectType('Project')
export class ProjectType {
  @Field(() => ID)
  id: string;

  @Field(() => Int)
  status: number;

  @Field()
  networkEndpoint: string;

  @Field()
  nodeEndpoint: string;

  @Field()
  queryEndpoint: string;
}
