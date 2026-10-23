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

    // Ugašena škola se više NE NUDI pri upisu novog učenika, ali se i
    // dalje vidi svuda gde postoje njeni učenici — u spisku, detaljima
    // i izveštajima. Gasi se samo ponuda, nikad prikaz.
    @Column({ default: true })
    aktivan!: boolean;

    @OneToMany(() => Occupation, (occupation) => occupation.school, { nullable: false })
    occupations!: Occupation[];

    @OneToMany(() => User, (user) => user.school)
    users!: User[];
}