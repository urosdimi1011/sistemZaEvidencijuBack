import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    CreateDateColumn,
} from "typeorm";
import { Student } from "./Student";

@Entity()
export class Payment {
    @PrimaryGeneratedColumn()
    id!: number;

    // Uplata pojedinačnog iznosa
    @Column("decimal", { precision: 10, scale: 2 })
    amount!: number;

    // Datum uplate
    @CreateDateColumn()
    paidAt!: Date;

    // Povezujemo uplatu sa studentom
    @ManyToOne(() => Student, (student) => student.payments, { nullable: false ,onDelete: "CASCADE"})
    student!: Student;
}