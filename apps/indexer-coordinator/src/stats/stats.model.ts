// Copyright 2020-2023 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import { Expose } from 'class-transformer';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
@Unique(['dataTime', 'deploymentCid'])
export class ProjectStatisticsEntity {
  @PrimaryGeneratedColumn()
  @Expose({ name: 'id' })
  id: number;

  @CreateDateColumn()
  @Expose({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn()
  @Expose({ name: 'updated_at' })
  updatedAt: Date;

  @Column('timestamp')
  @Expose({ name: 'data_time' })
  dataTime: Date;

  @Column()
  @Expose({ name: 'deployment_cid' })
  deploymentCid: string;

  @Column({ nullable: true })
  @Expose({ name: 'sevice_endpoint_type' })
  serviceEndpointType: string;

  @Column({ default: 0 })
  @Expose({ name: 'time' })
  time: number;

  @Column({ default: 0 })
  @Expose({ name: 'failure' })
  failure: number;

  @Column({ default: 0 })
  @Expose({ name: 'free_http' })
  freeHttp: number;

  @Column({ default: 0 })
  @Expose({ name: 'free_p2p' })
  freeP2p: number;

  @Column({ default: 0 })
  @Expose({ name: 'ca_http' })
  caHttp: number;

  @Column({ default: 0 })
  @Expose({ name: 'ca_p2p' })
  caP2p: number;

  @Column({ default: 0 })
  @Expose({ name: 'payg_http' })
  paygHttp: number;

  @Column({ default: 0 })
  @Expose({ name: 'payg_p2p' })
  paygP2p: number;
}

// export interface ProjectStatisticInput {
//   time: number;
//   failure: number;
//   free_http: number;
//   free_p2p: number;
//   ca_http: number;
//   ca_p2p: number;
//   payg_http: number;
//   payg_p2p: number;
// }

export class ProjectStatisticsMapInput {
  [hour: string]: {
    [deployment_cid: string]: ProjectStatisticsEntity;
  };
}

// export class ProjectStatisticMapInputClass implements ProjectStatisticMapInput {
//   [hour: string]: {
//     [deployment_cid: string]: ProjectStatisticEntity;
//   };
// }
