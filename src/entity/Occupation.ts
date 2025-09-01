import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    OneToMany
} from 'typeorm';
import {Menadzer} from "./Menadzer";
import {School} from "./School";
import {Student} from "./Student";

@Entity()
export class Occupation {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ unique: true })
    name!: string;

    @ManyToOne(() => School, (mgr) => mgr.occupations, { nullable: false })
    school!: School;

    @OneToMany(() => Student, (student) => student.occupation)
    students!: Student[]

    @UpdateDateColumn()
    updatedAt!: Date;
}