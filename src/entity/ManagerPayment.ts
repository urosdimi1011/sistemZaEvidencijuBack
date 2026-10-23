import {Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn} from "typeorm";
import {Menadzer} from "./Menadzer";
import {Student} from "./Student";
import {Payment} from "./Payment";

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

    // Uplata učenika koju ova isplata pokriva. Menadžer zarađuje svoj
    // procenat od svake uplate, pa svaka uplata ima svoju "ratu".
    // NULL = isplata uneta ručno, pre ovog načina rada.
    @ManyToOne(() => Payment, { nullable: true, onDelete: "CASCADE" })
    @JoinColumn({ name: "paymentId" })
    payment!: Payment | null;

    @Column("int", { nullable: true, default: null })
    paymentId!: number | null;
}