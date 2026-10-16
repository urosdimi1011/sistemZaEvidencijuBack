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

    // Da li se zanimanje nudi pri upisu redovnih učenika.
    // Vanrednim učenicima se nude sva zanimanja škole.
    @Column({ default: false })
    zaRedovne!: boolean;

    // Podrazumevana cena školarine za ovaj smer. Služi samo da se polje
    // pri upisu učenika samo popuni — administracija je po potrebi menja
    // za pojedinačnog učenika. NULL znači da cena još nije određena.
    @Column('decimal', { precision: 10, scale: 2, nullable: true, default: null })
    cena!: number | null;

    @ManyToOne(() => School, (mgr) => mgr.occupations, { nullable: false })
    school!: School;

    @OneToMany(() => Student, (student) => student.occupation)
    students!: Student[]

    @UpdateDateColumn()
    updatedAt!: Date;
}