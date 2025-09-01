import {Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn} from "typeorm";
import {Menadzer} from "./Menadzer";
import {Student} from "./Student";

@Entity()
export class ManagerPayment {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column("decimal", { precision: 10, scale: 2 })
    amount!: number; // Iznos isplate menadžeru

    @CreateDateColumn()
    paidAt!: Date; // Datum isplate

    @ManyToOne(() => Menadzer, (menadzer) => menadzer.isplate,{onDelete:"CASCADE"})
    menadzer!: Menadzer; // Kom se isplaćuje


    @ManyToOne(() => Student, (student) => student.managerPayouts,{onDelete:"CASCADE"})
    student!: Student; // Student čija školarina generiše proviziju

    @Column()
    studentId!: number;

    @Column()
    description!: string; // Opis (npr. "Provizija za uplatu ID 123")
}