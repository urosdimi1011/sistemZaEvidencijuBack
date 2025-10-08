import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    JoinColumn, Index, OneToMany, CreateDateColumn,
} from 'typeorm'

import { Menadzer } from './Menadzer'
import {Payment} from "./Payment";
import {ManagerPayment} from "./ManagerPayment";
import {Occupation} from "./Occupation";
@Entity('student')
export class Student {
    @PrimaryGeneratedColumn()
    id!: number

    @ManyToOne(() => Occupation,(occupation) => occupation.students)
    @JoinColumn({ name: 'occupationId' })
    occupation!: Occupation

    @Column()
    occupationId!: number | null;

    @Index()
    @Column({ type: 'varchar', length: 100 })
    ime!: string

    @Column({ type: 'varchar', length: 100, nullable:true })
    imeRoditelja !: string | null

    @Index()
    @Column({ type: 'varchar', length: 100 })
    prezime!: string | null

    @ManyToOne(() => Menadzer, (mgr) => mgr.students, {
        nullable: true,
        onDelete: 'SET NULL'
    })
    @JoinColumn({ name: 'managerId' })
    menadzer!: Menadzer | null

    @Column()
    managerId!: number | null;

    @Column({ type: 'text', nullable: true })
    note!: string | null;

    @Column('int',{
        nullable: true,
        default: null
    })
    literature!: number | null;

    
    @Column('varchar',{
        nullable: true,
        default: null
    })
    type!: 'vandredni' | 'redovni'; 

    
    @Column('varchar',{
        nullable: true,
        default: null
    })
    entry_type!: 'prekvalifikacija' | 'dokvalifikacija' | 'vanredni';


    @OneToMany(() => Payment, (payment) => payment.student)
    payments!: Payment[];

    @OneToMany(() => ManagerPayment, (payout) => payout.student)
    managerPayouts!: ManagerPayment[];

    @Column('decimal', { precision: 10, scale: 2 })
    cenaSkolarine!: number

    @Column('int', {
        nullable: true,
        default: null
    })
    procenatManagera!: number | null


    @CreateDateColumn()
    createdAt!: Date;

    
}