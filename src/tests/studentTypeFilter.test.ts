/**
 * Provera filtera "Тип ученика" (redovni / vandredni).
 * Pokreće se sa: npm run test:filter
 *
 * Test gradi where-uslov na isti način kao ruta GET /students i proverava
 * da li vraćeni učenici zaista odgovaraju izabranom tipu.
 */
import { AppDataSource } from "../data-source";
import { Student } from "../entity/Student";
import { FindOptionsWhere, ILike, IsNull } from "typeorm";
import { searchVariants } from "../utiles/transliterate";

// Ista logika kao u ruti: sklapanje where-uslova od filtera
export function buildStudentWhere(params: {
    type?: string;
    schoolId?: string;
    search?: string;
}): FindOptionsWhere<Student> | FindOptionsWhere<Student>[] {
    const baseWhere: FindOptionsWhere<Student> = {};

    if (params.schoolId) {
        baseWhere.occupation = { school: { id: Number(params.schoolId) } };
    }

    if (params.type === "bez_tipa") {
        baseWhere.type = IsNull();
    } else if (params.type && ["redovni", "vandredni"].includes(params.type)) {
        baseWhere.type = params.type as "redovni" | "vandredni";
    }

    if (!params.search) return baseWhere;

    const terms = params.search.trim().split(/\s+/).filter((t) => t.length > 0);
    const searchConditions: FindOptionsWhere<Student>[] = [];
    terms.forEach((term) => {
        searchVariants(term).forEach((variant) => {
            searchConditions.push(
                { ...baseWhere, ime: ILike(`%${variant}%`) },
                { ...baseWhere, prezime: ILike(`%${variant}%`) }
            );
        });
    });
    return searchConditions;
}

let greske = 0;

function proveri(opis: string, uslov: boolean, detalji = "") {
    if (uslov) {
        console.log(`  OK   ${opis}`);
    } else {
        greske++;
        console.log(`  PAD  ${opis} ${detalji}`);
    }
}

async function main() {
    await AppDataSource.initialize();
    const repo = AppDataSource.getRepository(Student);

    console.log("\n--- Zatečeno stanje u bazi ---");
    const ukupno = await repo.count();
    const bezTipa = await repo.count({ where: { type: IsNull() } });
    const redovni = await repo.count({ where: { type: "redovni" } });
    const vandredni = await repo.count({ where: { type: "vandredni" } });
    console.log(`  ukupno učenika:     ${ukupno}`);
    console.log(`  bez unetog tipa:    ${bezTipa}`);
    console.log(`  redovni:            ${redovni}`);
    console.log(`  vandredni:          ${vandredni}`);

    console.log("\n--- Filter po tipu ---");

    for (const tip of ["redovni", "vandredni"] as const) {
        const [studenti, count] = await repo.findAndCount({
            where: buildStudentWhere({ type: tip }),
            take: 100,
        });
        const sviOdgovaraju = studenti.every((s) => s.type === tip);
        proveri(
            `filter "${tip}" vraća ${count} učenika i svi su tog tipa`,
            sviOdgovaraju,
            sviOdgovaraju ? "" : `-> nađen tip: ${studenti.find((s) => s.type !== tip)?.type}`
        );
    }

    const [bezTipaLista, bezTipaCount] = await repo.findAndCount({
        where: buildStudentWhere({ type: "bez_tipa" }),
        take: 100,
    });
    proveri(
        `filter "bez_tipa" vraća ${bezTipaCount} učenika i nijedan nema tip`,
        bezTipaCount === bezTipa && bezTipaLista.every((s) => s.type === null)
    );

    const [, bezFiltera] = await repo.findAndCount({ where: buildStudentWhere({}) });
    proveri(
        `bez filtera vraća sve učenike (${bezFiltera} = ${ukupno})`,
        bezFiltera === ukupno
    );

    proveri(
        `zbir redovni + vandredni + bez tipa = ukupno (${redovni} + ${vandredni} + ${bezTipa} = ${ukupno})`,
        redovni + vandredni + bezTipa === ukupno
    );

    console.log("\n--- Nevalidna vrednost se ignoriše ---");
    const [, zaGluposti] = await repo.findAndCount({
        where: buildStudentWhere({ type: "nepostojeci_tip" }),
    });
    proveri(
        `nepoznat tip se ignoriše i vraća sve (${zaGluposti} = ${ukupno})`,
        zaGluposti === ukupno
    );

    console.log("\n--- Filter po tipu zajedno sa pretragom ---");
    const prviVandredni = await repo.findOne({ where: { type: "vandredni" } });
    if (prviVandredni) {
        const [nadjeni] = await repo.findAndCount({
            where: buildStudentWhere({ type: "vandredni", search: prviVandredni.ime }),
        });
        proveri(
            `pretraga "${prviVandredni.ime}" + tip "vandredni" vraća samo vandredne`,
            nadjeni.every((s) => s.type === "vandredni")
        );

        const [pogresanTip] = await repo.findAndCount({
            where: buildStudentWhere({ type: "redovni", search: prviVandredni.ime }),
        });
        proveri(
            `pretraga "${prviVandredni.ime}" + tip "redovni" ne vraća vandredne`,
            pogresanTip.every((s) => s.type === "redovni")
        );
    } else {
        console.log("  (preskočeno — nema nijednog vandrednog učenika)");
    }

    console.log(
        greske === 0
            ? "\nREZULTAT: sve provere prošle\n"
            : `\nREZULTAT: ${greske} provera nije prošla\n`
    );

    await AppDataSource.destroy();
    process.exit(greske === 0 ? 0 : 1);
}

main().catch(async (e) => {
    console.error("Greška pri izvršavanju testa:", e);
    process.exit(1);
});
