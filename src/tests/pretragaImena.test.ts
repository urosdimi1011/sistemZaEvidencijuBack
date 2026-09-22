/**
 * Посебна провера претраге по имену и презимену.
 * Pokreće se sa: npm run test:pretraga
 *
 * Претрага је најсложенији филтер: сваки унети појам се множи кроз варијанте
 * писма (латиница/ћирилица/dj), а сваки од њих даје два услова (име, презиме).
 * Овај тест мери колико услова настаје и да ли упит опстаје.
 */
import { AppDataSource } from "../data-source";
import { Student } from "../entity/Student";
import { buildStudentWhere, parseSearch } from "../utiles/studentFilters";
import { searchVariants } from "../utiles/transliterate";

let greske = 0;
let ukupno = 0;

function proveri(opis: string, uslov: boolean, detalj = "") {
    ukupno++;
    if (uslov) console.log(`  OK   ${opis} ${detalj}`);
    else {
        greske++;
        console.log(`  PAD  ${opis} ${detalj}`);
    }
}

/** Пушта прави упит и мери трајање. */
async function izmeri(opis: string, search: string, dodatni: any = {}) {
    const repo = AppDataSource.getRepository(Student);
    const where = buildStudentWhere({ search, ...dodatni });
    const brojUslova = Array.isArray(where) ? where.length : 1;

    const pocetak = Date.now();
    try {
        await repo.findAndCount({
            where,
            relations: ["menadzer", "payments", "managerPayouts", "occupation.school"],
            order: { createdAt: "DESC" },
            take: 20,
            skip: 0,
        });
        const trajanje = Date.now() - pocetak;
        proveri(opis, true, `(услова: ${brojUslova}, ${trajanje}ms)`);
        return trajanje;
    } catch (e: any) {
        proveri(opis, false, `-> ${e.message?.split("\n")[0]}`);
        return -1;
    }
}

async function main() {
    await AppDataSource.initialize();

    console.log("\n=== Колико услова прави један појам ===");
    for (const pojam of ["Pera", "Ђорђе", "Djordje", "Ndjukic"]) {
        const v = searchVariants(pojam);
        console.log(`  "${pojam}" -> ${v.length} варијанти: ${v.join(", ")}`);
    }

    console.log("\n=== Обична претрага ===");
    await izmeri("једно име", "Pera");
    await izmeri("име и презиме", "Pera Peric");
    await izmeri("ћирилица", "Ђорђе Ђукић");
    await izmeri("латиница са dj", "Djordje Djukic");

    console.log("\n=== Гранични случајеви ===");
    await izmeri("само размаци", "     ");
    await izmeri("наводник", "O'Brien");
    await izmeri("проценат (LIKE џокер)", "%");
    await izmeri("доња црта (LIKE џокер)", "_%_%_%");
    await izmeri("бекслеш", "\\\\");
    await izmeri("SQL покушај", "'; DROP TABLE student; --");
    await izmeri("емоџи", "🙂🙂");

    console.log("\n=== Најгори случај (највише варијанти) ===");
    // Појмови са "dj" дају највише варијанти по појму
    const mnogoDj = Array(20).fill("djdj").join(" ");
    await izmeri("20 појмова са dj", mnogoDj);

    // Претрага заједно са свим осталим филтерима — сваки услов носи и њих
    await izmeri("претрага + школа + тип + датум", "Djordje Djukic", {
        schoolId: "2",
        type: "vandredni",
        date: "2025-09-01",
    });

    console.log("\n=== Заштита од предугачког уноса ===");
    const ogroman = "djdj ".repeat(2000); // 10.000 знакова
    proveri(
        "унос од 10.000 знакова се скраћује на 100",
        parseSearch(ogroman).length <= 100,
        `(добијено ${parseSearch(ogroman).length})`
    );
    await izmeri("унос од 10.000 знакова", ogroman);

    // Провера колико би услова настало БЕЗ скраћивања (старо понашање)
    const bezOgranicenja = buildStudentWhere({ search: ogroman });
    const saOgranicenjem = Array.isArray(bezOgranicenja) ? bezOgranicenja.length : 1;
    console.log(`  Са ограничењем настаје ${saOgranicenjem} услова.`);

    console.log(
        greske === 0
            ? `\nРЕЗУЛТАТ: свих ${ukupno} провера прошло\n`
            : `\nРЕЗУЛТАТ: ${greske} од ${ukupno} провера НИЈЕ прошло\n`
    );

    await AppDataSource.destroy();
    process.exit(greske === 0 ? 0 : 1);
}

main().catch(async (e) => {
    console.error("Тест се срушио:", e);
    process.exit(1);
});
