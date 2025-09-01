import {Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany, Index, UpdateDateColumn} from 'typeorm';


import {Student} from './Student';
import {ManagerPayment} from "./ManagerPayment";
import {Payment} from "./Payment";
@Entity()
export class Menadzer {
    @PrimaryGeneratedColumn()
    id!: number;

    @Index()
    @Column()
    ime!: string;

    @Index()
    @Column()
    prezime!: string;

    @CreateDateColumn()
    datumKreiranja!: Date;

    @UpdateDateColumn()
    datumIzmene!: Date;

    @OneToMany(() => Student, (student) => student.menadzer)
    students!: Student[]

    @OneToMany(() => ManagerPayment, (isplata) => isplata.menadzer)
    isplate!: ManagerPayment[];
}