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