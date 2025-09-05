import { DataSource } from "typeorm";
import { faker } from "@faker-js/faker";
import {Student} from "../entity/Student";
import {AppDataSource} from "../data-source";

export async function seedStudents(dataSource: DataSource) {
    const studentRepository = dataSource.getRepository(Student);

    // ID-evi menadžera koji su dostupni (uključujući i null za studente bez menadžera)
    const availableManagerIds = [4, 5, 6, 8, 9, 10, null];
    const occupationIds = [1,2,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40];

    // Generisanje 1000 studenata
    const students = [];

    for (let i = 0; i < 1000; i++) {
        const student = new Student();

        // Nasumično odaberi da li će student imati menadžera (70% šanse da ima)
        const hasManager = Math.random() < 0.7;

        // Nasumično odaberi ID menadžera iz liste dostupnih
        const randomManagerIndex = Math.floor(Math.random() * availableManagerIds.length);
        const randomOccupationIndex = Math.floor(Math.random() * occupationIds.length);
        const managerId = hasManager ? availableManagerIds[randomManagerIndex] : null;
        const occupationId = occupationIds[randomOccupationIndex];

        // Postavi osnovne podatke
        student.ime = faker.person.firstName();
        student.imeRoditelja = faker.person.firstName(); // 80% šanse da ima ime roditelja
        student.prezime = faker.person.lastName();
        student.managerId = managerId;
        student.cenaSkolarine = parseFloat(faker.finance.amount({min:1200,max:2000})); // Cena školarine između 500 i 5000
        student.procenatManagera = managerId ? Math.floor(Math.random() * 30) + 10 : null; // Procenat menadžera između 10% i 40% samo ako ima menadžera

        // Ostala polja koja nisu eksplicitno navedena ali postoje u entitetu
        student.occupationId = occupationId; // Možeš dodati i occupation ako je potrebno

        students.push(student);
    }

    try {
        // Snimi studente u bazu u serijama od po 100
        for (let i = 0; i < students.length; i += 100) {
            const batch = students.slice(i, i + 100);
            await studentRepository.save(batch);
            console.log(`Snimljena serija ${i / 100 + 1} od ${Math.ceil(students.length / 100)}`);
        }

        console.log("Uspešno generisano 1000 studenata!");
    } catch (error) {
        console.error("Greška pri generisanju studenata:", error);
    }
}

// Pokreni seed ako se skripta pokreće direktno
if (require.main === module) {
    async function runSeed() {
        try {
            // Inicijalizuj konekciju sa bazom
            await AppDataSource.initialize();
            console.log("Data Source has been initialized!");

            // Pozovi seed funkciju
            await seedStudents(AppDataSource);

            console.log("Seed completed successfully!");
        } catch (error) {
            console.error("Error during seed:", error);
        } finally {
            // Zatvori konekciju
            await AppDataSource.destroy();
            console.log("Connection closed");
        }
    }
    runSeed();
}

// Kako koristiti funkciju:
// 1. Ustvari DataSource konekciju
// 2. Pozovi seedStudents(dataSource)