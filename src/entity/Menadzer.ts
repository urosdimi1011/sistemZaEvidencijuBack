import {Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany, Index, UpdateDateColumn} from 'typeorm';


import {Student} from './Student';
import {ManagerPayment} from "./ManagerPayment";

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

    // Podrazumevani procenat menadžera — prepisuje se na učenika pri upisu.
    // Izmena ovde važi samo za buduće upise; već upisani učenici zadržavaju svoj procenat.
    @Column('int', { default: 20 })
    procenat!: number;

    @CreateDateColumn()
    datumKreiranja!: Date;

    @UpdateDateColumn()
    datumIzmene!: Date;

    @OneToMany(() => Student, (student) => student.menadzer)
    students!: Student[]

    @OneToMany(() => ManagerPayment, (isplata) => isplata.menadzer)
    isplate!: ManagerPayment[];
}