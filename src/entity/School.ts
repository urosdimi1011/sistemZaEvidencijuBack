import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    OneToMany
} from 'typeorm';
import {Student} from "./Student";
import {Occupation} from "./Occupation";

@Entity()
export class School {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ unique: true })
    name!: string;

    @OneToMany(() => Occupation, (occupation) => occupation.school, { nullable: false })
    occupations!: Occupation[];
}