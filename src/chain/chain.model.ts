import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class Chain {
    @PrimaryColumn()
    name: string;

    @Column()
    value: string;
}