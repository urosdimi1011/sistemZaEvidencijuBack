/**
 * Provera filtera na нападачки и неуредан унос.
 * Pokreće se sa: npm run test:filters
 *
 * Cilj nije "da li filter nalazi tačne učenike" (to pokriva studentTypeFilter),
 * nego "da li nešto obara upit" — jer svaki pad ovde na klijentu izgleda
 * kao da je aplikacija pukla.
 */
import { AppDataSource } from "../data-source";
import { Student } from "../entity/Student";
import {
    buildStudentWhere,
    parsePagination,
    parseSortBy,
    parseSortOrder,
    parseSchoolId,
    parseDanOpseg,
    parseSearch,
} from "../utiles/studentFilters";

let greske = 0;
let provera = 0;

function proveri(opis: string, uslov: boolean, detalj = "") {
    provera++;
    if (uslov) {
        console.log(`  OK   ${opis}`);
    } else {
        greske++;
        console.log(`  PAD  ${opis} ${detalj}`);
    }
}

/** Пушта прави упит и пријављује ако обори базу. */
async function upitNePuca(opis: string, params: any, order?: any) {
    const repo = AppDataSource.getRepository(Student);
    try {
        await repo.findAndCount({
            where: buildStudentWhere(params),
            relations: ["menadzer", "payments", "managerPayouts", "occupation.school"],
            order: order ?? { createdAt: "DESC" },
            take: 5,
            skip: 0,
        });
        proveri(opis, true);
    } catch (e: any) {
        proveri(opis, false, `-> ${e.message?.split("\n")[0]}`);
    }
}

async function main() {
    await AppDataSource.initialize();

    console.log("\n=== 1. Обрада параметара (без базе) ===");

    proveri("страна 'abc' пада на 1", parsePagination({ page: "abc" }).page === 1);
    proveri("страна -5 пада на 1", parsePagination({ page: "-5" }).page === 1);
    proveri("страна 0 пада на 1", parsePagination({ page: "0" }).page === 1);
    proveri(
        "огроман limit се ограничава на 100",
        parsePagination({ limit: "999999" }).limit === 100
    );
    proveri("limit 0 пада на 20", parsePagination({ limit: "0" }).limit === 20);
    proveri(
        "limit -10 се ограничава на 1 или више",
        parsePagination({ limit: "-10" }).limit >= 1
    );

    proveri(
        "непознато поље сортирања пада на createdAt",
        parseSortBy("id; DROP TABLE student") === "createdAt"
    );
    proveri("празно поље сортирања пада на createdAt", parseSortBy(undefined) === "createdAt");
    proveri(
        "нев��лидан смер сортирања пада на DESC",
        parseSortOrder("DROP TABLE student") === "DESC"
    );
    proveri("смер 'asc' се прихвата", parseSortOrder("asc") === "ASC");
    proveri("смер undefined пада на DESC", parseSortOrder(undefined) === "DESC");

    proveri("schoolId 'abc' постаје null", parseSchoolId("abc") === null);
    proveri("schoolId '' постаје null", parseSchoolId("") === null);
    proveri("schoolId '3.7' постаје null", parseSchoolId("3.7") === null);
    proveri("schoolId '-2' постаје null", parseSchoolId("-2") === null);
    proveri("schoolId '2' остаје број 2", parseSchoolId("2") === 2);

    proveri("датум 'juce' постаје null", parseDanOpseg("juce") === null);
    proveri("датум '' постаје null", parseDanOpseg("") === null);
    proveri("исправан датум даје опсег", parseDanOpseg("2026-09-21") !== null);

    proveri(
        "предугачка претрага се скраћује",
        parseSearch("a".repeat(5000)).length <= 100
    );
    proveri("претрага са бројем постаје текст", parseSearch(12345 as any) === "");

    console.log("\n=== 2. Прави упити са неисправним филтерима ===");

    await upitNePuca("без иједног филтера", {});
    await upitNePuca("schoolId = 'abc'", { schoolId: "abc" });
    await upitNePuca("schoolId = NaN", { schoolId: NaN });
    await upitNePuca("schoolId = '999999'", { schoolId: "999999" });
    await upitNePuca("датум = 'juce'", { date: "juce" });
    await upitNePuca("датум = '0000-00-00'", { date: "0000-00-00" });
    await upitNePuca("тип = 'нешто'", { type: "нешто" });
    await upitNePuca("тип = 'bez_tipa'", { type: "bez_tipa" });
    await upitNePuca("напомена = 'ima' (админ)", {
        napomena: "ima",
        user: { role: "admin" },
    });

    console.log("\n=== 3. Претрага са посебним знаковима ===");

    await upitNePuca("наводник у претрази", { search: "O'Brien" });
    await upitNePuca("проценат у претрази", { search: "%" });
    await upitNePuca("доња црта у претрази", { search: "_" });
    await upitNePuca("бекслеш у претрази", { search: "\\" });
    await upitNePuca("SQL покушај у претрази", {
        search: "'; DROP TABLE student; --",
    });
    await upitNePuca("ћирилица у претрази", { search: "Ђорђе Ђукић" });
    await upitNePuca("емоџи у претрази", { search: "🙂" });
    await upitNePuca("само размаци", { search: "     " });
    await upitNePuca("предугачка претрага", { search: "a".repeat(5000) });
    await upitNePuca("много речи у претрази", {
        search: Array(30).fill("Petar").join(" "),
    });

    console.log("\n=== 4. Сортирање ===");

    const zloOrder: any = {};
    zloOrder[parseSortBy("cenaSkolarine")] = parseSortOrder("BOOM");
    await upitNePuca("смер сортирања 'BOOM' се неутралише", {}, zloOrder);

    console.log("\n=== 5. Ограничења налога се не могу заобићи ===");

    const gdeSkolski = buildStudentWhere({
        schoolId: "999",
        type: "redovni",
        user: { role: "school_manager", schoolId: 2, tipUpisa: "vandredni" },
    }) as any;

    proveri(
        "налог школе не може да види другу школу преко URL-а",
        gdeSkolski?.occupation?.school?.id === 2,
        `-> добијено ${JSON.stringify(gdeSkolski?.occupation)}`
    );
    proveri(
        "налог за ванредне не може да тражи редовне",
        gdeSkolski?.type === "vandredni",
        `-> добијено ${gdeSkolski?.type}`
    );

    const gdeNeadmin = buildStudentWhere({
        napomena: "neobradjene",
        user: { role: "school_manager", schoolId: 2, tipUpisa: "vandredni" },
    }) as any;
    proveri(
        "филтер по напомени не важи за налог школе",
        gdeNeadmin?.note === undefined
    );

    console.log(
        greske === 0
            ? `\nРЕЗУЛТАТ: свих ${provera} провера прошло\n`
            : `\nРЕЗУЛТАТ: ${greske} од ${provera} провера НИЈЕ прошло\n`
    );

    await AppDataSource.destroy();
    process.exit(greske === 0 ? 0 : 1);
}

main().catch(async (e) => {
    console.error("Тест се срушио:", e);
    process.exit(1);
});
