import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class Project {
  @PrimaryColumn()
  id: string; // deploymentId

  @Column()
  status: number;

  @Column()
  indexerEndpoint: string; // endpoint of indexer service

  @Column()
  queryEndpoint: string; // endpoint of query service

  @Column()
  blockHeight: number;
}

@ObjectType('Project')
export class ProjectType {
  @Field(() => ID)
  id: string;

  @Field(() => Int)
  status: number;

  @Field()
  indexerEndpoint: string;

  @Field()
  queryEndpoint: string;

  @Field(() => Int)
  blockHeight: number;
}

@ObjectType('ServiceMetaData')
export class ServiceMetaDataType {
  @Field(() => Int)
  lastProcessedHeight: number;

  @Field(() => Date)
  lastProcessedTimestamp: number;

  @Field(() => Int)
  targetHeight: number;

  @Field()
  chain: string;

  @Field()
  specName: string;

  @Field()
  genesisHash: string;

  @Field()
  indexerHealthy: boolean;

  @Field()
  indexerNodeVersion: string;

  @Field()
  queryNodeVersion: string;
}
