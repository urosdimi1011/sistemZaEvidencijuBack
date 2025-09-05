import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    OneToMany
} from 'typeorm';
import {Student} from "./Student";
import {Occupation} from "./Occupation";
import {User} from "./User";

@Entity()
export class School {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ unique: true })
    name!: string;

    @OneToMany(() => Occupation, (occupation) => occupation.school, { nullable: false })
    occupations!: Occupation[];

    @OneToMany(() => User, (user) => user.school)
    users!: User[];
}