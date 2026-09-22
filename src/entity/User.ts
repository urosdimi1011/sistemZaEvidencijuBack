import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    ManyToOne,
    JoinColumn
} from 'typeorm';
import {School} from "./School";

@Entity()
export class User {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ unique: true })
    email!: string;

    @Column()
    password!: string;

    @Column()
    role!: 'admin' | 'school_manager' | 'korisnik'; // Dodajte druge role po potrebi

    // Koju vrstu upisa nalog obrađuje. Odnosi se samo na school_manager naloge:
    // nalog vidi i unosi isključivo učenike tog tipa. Kod admina i
    // računovođe je NULL — oni vide sve.
    @Column({ type: 'varchar', nullable: true, default: null })
    tipUpisa!: 'redovni' | 'vandredni' | null;


    @ManyToOne(() => School, (school) => school.users, { nullable: true })
    @JoinColumn({ name: 'schoolId' })
    school!: School | null;

    @Column({ nullable: true })
    schoolId!: number | null;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}