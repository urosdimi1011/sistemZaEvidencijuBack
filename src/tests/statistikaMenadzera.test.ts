/**
 * Провера статистике менаџера по годинама и месецима.
 * Покреће се са: npm run test:statistika
 *
 * Најважније што се овде брани:
 *
 *      збир прихода по годинама  ===  укупан приход
 *      збир прихода по месецима  ===  укупан приход
 *
 * Ако то важи, клијент може да сабере колону на екрану и да се поклопи
 * са укупним износом — а баш то је тражио.
 *
 * Пушта се и над стварним подацима из базе, менаџер по менаџер.
 */
import { AppDataSource } from "../data-source";
import { Menadzer } from "../entity/Menadzer";
import {
  getYearlyStats,
  getMonthlyStats,
  getMonthlyStatsForYear,
  filterStudentsByRangeAndYear,
  StavkaStatistike,
} from "../utiles/ManagerFunctions";
import { getSchoolYearLabel } from "../utiles/schoolYear";

let greske = 0;
let provera = 0;

function proveri(opis: string, uslov: boolean, detalj = "") {
  provera++;
  if (uslov) {
    console.log(`  OK   ${opis}`);
  } else {
    greske++;
    console.log(`  ПАД  ${opis} ${detalj}`);
  }
}

function jednako(opis: string, dobijeno: any, ocekivano: any) {
  proveri(opis, Object.is(dobijeno, ocekivano), `-> ${dobijeno} уместо ${ocekivano}`);
}

const n = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x));
const istiIznos = (a: number, b: number) => Math.abs(a - b) < 0.005;

const zbirPrihoda = (m: { [k: string]: StavkaStatistike }) =>
  Object.values(m).reduce((z, s) => z + s.prihod, 0);
const zbirUcenika = (m: { [k: string]: StavkaStatistike }) =>
  Object.values(m).reduce((z, s) => z + s.brojUcenika, 0);

/** Измишљен ученик уписан датог дана. */
function uc(datum: string, cena: number) {
  return { createdAt: datum, cenaSkolarine: cena };
}

async function main() {
  console.log("\n=== 1. Рачун на измишљеним подацима ===");

  // Школска година иде 1.9 – 31.8, па септембар 2025. и јануар 2026.
  // припадају ИСТОЈ школској години 2025/2026.
  const studenti = [
    uc("2025-09-15", 1000),
    uc("2026-01-20", 1500),
    uc("2026-08-31", 500),
    uc("2026-09-01", 2000), // већ следећа школска година
  ];

  const godisnje = getYearlyStats(studenti);

  jednako("2025/2026 — број ученика", godisnje["2025/2026"]?.brojUcenika, 3);
  jednako("2025/2026 — приход", godisnje["2025/2026"]?.prihod, 3000);
  jednako("2026/2027 — број ученика", godisnje["2026/2027"]?.brojUcenika, 1);
  jednako("2026/2027 — приход", godisnje["2026/2027"]?.prihod, 2000);

  proveri(
    "31. август остаје у старој школској години",
    godisnje["2025/2026"]?.brojUcenika === 3
  );
  proveri(
    "1. септембар прелази у нову",
    godisnje["2026/2027"]?.brojUcenika === 1
  );

  jednako("збир прихода по годинама = укупно", zbirPrihoda(godisnje), 5000);
  jednako("збир ученика по годинама = укупно", zbirUcenika(godisnje), 4);

  const mesecno = getMonthlyStats(studenti);
  jednako("септембар 2025 — приход", mesecno["2025-09"]?.prihod, 1000);
  jednako("јануар 2026 — приход", mesecno["2026-01"]?.prihod, 1500);
  jednako("збир прихода по месецима = укупно", zbirPrihoda(mesecno), 5000);

  const zaGodinu = getMonthlyStatsForYear(studenti, 2025);
  jednako("школска година има свих 12 месеци", Object.keys(zaGodinu).length, 12);
  jednako("први месец је септембар", Object.keys(zaGodinu)[0], "2025-09");
  jednako(
    "месеци једне школске године носе само њен приход",
    zbirPrihoda(zaGodinu),
    3000
  );
  jednako("празан месец има нулу, не недостаје", zaGodinu["2025-11"]?.prihod, 0);

  console.log("\n=== 2. Гранични унос ===");

  jednako("празан списак — нема ставки", Object.keys(getYearlyStats([])).length, 0);

  const bezCene = getYearlyStats([uc("2025-09-15", null as any)]);
  jednako("ученик без цене се броји", bezCene["2025/2026"]?.brojUcenika, 1);
  jednako("ученик без цене не квари приход", bezCene["2025/2026"]?.prihod, 0);

  const stringCena = getYearlyStats([
    { createdAt: "2025-09-15", cenaSkolarine: "1200.50" },
  ]);
  jednako(
    "цена као стринг из базе се сабира као број",
    stringCena["2025/2026"]?.prihod,
    1200.5
  );

  // Децимале: три по 333.33 не смеју да дају 999.99000000001
  const decimale = getYearlyStats([
    uc("2025-09-01", 333.33),
    uc("2025-09-02", 333.33),
    uc("2025-09-03", 333.33),
  ]);
  jednako(
    "збир децималних цена је заокружен на две децимале",
    decimale["2025/2026"]?.prihod,
    999.99
  );

  console.log("\n=== 3. Стварни подаци из базе ===");

  await AppDataSource.initialize();
  const menadzeri = await AppDataSource.getRepository(Menadzer).find({
    relations: ["students"],
  });

  console.log(`  Учитано менаџера: ${menadzeri.length}\n`);

  let saUcenicima = 0;
  let neslaganja = 0;

  for (const m of menadzeri) {
    const svi = filterStudentsByRangeAndYear(m.students ?? [], "", "all");
    if (svi.length === 0) continue;
    saUcenicima++;

    const ukupanPrihod = svi.reduce(
      (z, s: any) => z + (Number(s.cenaSkolarine) || 0),
      0
    );
    const god = getYearlyStats(svi);
    const mes = getMonthlyStats(svi);

    const okGod = istiIznos(zbirPrihoda(god), ukupanPrihod);
    const okMes = istiIznos(zbirPrihoda(mes), ukupanPrihod);
    const okBroj = zbirUcenika(god) === svi.length;

    if (!okGod || !okMes || !okBroj) {
      neslaganja++;
      console.log(
        `  ПАД  ${m.ime} ${m.prezime}: укупно ${n(ukupanPrihod)}, ` +
          `по годинама ${n(zbirPrihoda(god))}, по месецима ${n(zbirPrihoda(mes))}`
      );
    }
  }

  proveri(
    `збир по годинама = укупан приход, за свих ${saUcenicima} менаџера са ученицима`,
    neslaganja === 0,
    `-> одступа код ${neslaganja}`
  );

  // Испис за три највећа менаџера, да се види како ће изгледати на екрану
  const najveci = menadzeri
    .filter((m) => (m.students?.length ?? 0) > 0)
    .sort((a, b) => (b.students?.length ?? 0) - (a.students?.length ?? 0))
    .slice(0, 3);

  for (const m of najveci) {
    const svi = m.students ?? [];
    const ukupno = svi.reduce((z, s: any) => z + (Number(s.cenaSkolarine) || 0), 0);
    const god = getYearlyStats(svi);
    console.log(
      `\n  ${m.ime} ${m.prezime} — ${svi.length} ученика, укупно ${n(ukupno)} €`
    );
    for (const [godina, s] of Object.entries(god).sort(([a], [b]) =>
      b.localeCompare(a)
    )) {
      console.log(
        `      ${godina}   ${String(s.brojUcenika).padStart(4)} уч.   ${n(
          s.prihod
        ).padStart(12)} €`
      );
    }
    console.log(
      `      ${"збир".padEnd(9)} ${String(zbirUcenika(god)).padStart(
        4
      )} уч.   ${n(zbirPrihoda(god)).padStart(12)} €`
    );
  }

  console.log(
    greske === 0
      ? `\nРЕЗУЛТАТ: свих ${provera} провера прошло\n`
      : `\nРЕЗУЛТАТ: ${greske} од ${provera} провера НИЈЕ прошло\n`
  );

  await AppDataSource.destroy();
  process.exit(greske === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("Тест се срушио:", e);
  process.exit(1);
});
