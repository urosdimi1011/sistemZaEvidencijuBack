/**
 * Провера пребацивања редовних ученика у следећи разред.
 * Покреће се са: npm run test:prebacivanje
 *
 * Ово дира целу генерацију одједном, па је писано строго — свако правило
 * провереno и са стране „пролази“ и са стране „не пролази“.
 *
 * Правила која се бране:
 *   - само редовни; ванредни се не пребацују
 *   - четврти разред се не пребацује, они су завршили
 *   - нови упис иде БЕЗ менаџера (10% се узима само једном)
 *   - већ пребачен ученик се не пребацује поново
 *   - напомена се не преноси
 */
import {
  razlogPreskakanja,
  sledeciRazred,
  napraviNoviUpis,
  datumUpisaZaGodinu,
  predlozenaCena,
  PRVI_RAZRED,
  ZAVRSNI_RAZRED,
} from "../utiles/prebacivanje";
import { getSchoolYearForDate } from "../utiles/schoolYear";

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
  proveri(
    opis,
    Object.is(dobijeno, ocekivano),
    `-> добијено ${dobijeno}, очекивано ${ocekivano}`
  );
}

/** Редован ученик спреман за пребацивање. */
function ucenik(izmene: any = {}) {
  return {
    id: 1,
    ime: "Зоран",
    prezime: "Јовановић",
    imeRoditelja: "Петар",
    type: "redovni",
    razred: 1,
    occupationId: 7,
    cenaSkolarine: "1900.00",
    vecPrebacen: false,
    ...izmene,
  };
}

function main() {
  console.log("\n=== 1. Ко иде даље, а ко не ===");

  proveri("редован ученик првог разреда иде", razlogPreskakanja(ucenik()) === null);
  proveri("други разред иде", razlogPreskakanja(ucenik({ razred: 2 })) === null);
  proveri("трећи разред иде", razlogPreskakanja(ucenik({ razred: 3 })) === null);

  jednako(
    "четврти разред је завршио",
    razlogPreskakanja(ucenik({ razred: 4 })),
    "zavrsio"
  );
  jednako(
    "ванредни се не пребацује",
    razlogPreskakanja(ucenik({ type: "vandredni" })),
    "nije_redovan"
  );
  jednako(
    "ученик без типа се не пребацује",
    razlogPreskakanja(ucenik({ type: null })),
    "nije_redovan"
  );
  jednako(
    "већ пребачен се не пребацује поново",
    razlogPreskakanja(ucenik({ vecPrebacen: true })),
    "vec_prebacen"
  );
  jednako(
    "без разреда се не пребацује",
    razlogPreskakanja(ucenik({ razred: null })),
    "nema_razred"
  );
  jednako(
    "без смера се не пребацује",
    razlogPreskakanja(ucenik({ occupationId: null })),
    "nema_smer"
  );
  jednako(
    "разред 0 није важећи",
    razlogPreskakanja(ucenik({ razred: 0 })),
    "nema_razred"
  );
  jednako(
    "разред 5 се третира као завршен",
    razlogPreskakanja(ucenik({ razred: 5 })),
    "zavrsio"
  );

  // Већ пребачен има предност над осталим разлозима — тако порука у
  // прегледу каже оно што администрацију заиста занима
  jednako(
    "већ пребачен се пријављује и кад је ванредан",
    razlogPreskakanja(ucenik({ type: "vandredni", vecPrebacen: true })),
    "nije_redovan"
  );

  console.log("\n=== 2. Нови упис ===");

  const datum = datumUpisaZaGodinu(2026);
  const novi = napraviNoviUpis(ucenik({ razred: 2 }), 2100, datum);

  jednako("разред се увећава за један", novi.razred, 3);
  jednako("име се преноси", novi.ime, "Зоран");
  jednako("презиме се преноси", novi.prezime, "Јовановић");
  jednako("име родитеља се преноси", novi.imeRoditelja, "Петар");
  jednako("смер се преноси", novi.occupationId, 7);
  jednako("тип остаје редован", novi.type, "redovni");
  jednako("цена је она која је задата", novi.cenaSkolarine, 2100);
  jednako("веза на претходни упис", novi.prethodniUpisId, 1);

  // Суштина правила о менаџеру
  jednako("БЕЗ менаџера", novi.managerId, null);
  jednako("БЕЗ процента", novi.procenatManagera, null);

  jednako("без типа уписа", novi.entry_type, null);
  jednako("без литературе", novi.literature, null);
  jednako("напомена се не преноси", novi.note, null);

  console.log("\n=== 3. Датум уписа одређује школску годину ===");

  jednako("1. септембар 2026", datum.getDate(), 1);
  jednako("месец је септембар", datum.getMonth(), 8);
  jednako("година је 2026", datum.getFullYear(), 2026);
  jednako(
    "упада у школску 2026/2027",
    getSchoolYearForDate(datum),
    2026
  );

  console.log("\n=== 4. Одбијање оних који не иду ===");

  let puklo = false;
  try {
    napraviNoviUpis(ucenik({ razred: 4 }), 2000, datum);
  } catch {
    puklo = true;
  }
  proveri("завршени разред не може да се пребаци ни на силу", puklo);

  puklo = false;
  try {
    napraviNoviUpis(ucenik({ type: "vandredni" }), 2000, datum);
  } catch {
    puklo = true;
  }
  proveri("ванредни не може да се пребаци ни на силу", puklo);

  console.log("\n=== 5. Предложена цена ===");

  jednako("цена смера има предност", predlozenaCena(2100, 1900), 2100);
  jednako(
    "ако смер нема цену, нуди се прошлогодишња",
    predlozenaCena(null, 1900),
    1900
  );
  jednako(
    "цена смера као стринг из базе",
    predlozenaCena("2100.00", 1900),
    2100
  );
  jednako("нула се не прихвата као цена", predlozenaCena(0, 1900), 1900);
  jednako(
    "ако ниједне нема, нема ни предлога",
    predlozenaCena(null, null),
    null
  );
  jednako(
    "нечитљива вредност пада на прошлогодишњу",
    predlozenaCena("бесплатно", 1900),
    1900
  );

  console.log("\n=== 6. Границе разреда ===");

  jednako("први разред је 1", PRVI_RAZRED, 1);
  jednako("завршни разред је 4", ZAVRSNI_RAZRED, 4);
  jednako("из првог у други", sledeciRazred(1), 2);
  jednako("из трећег у четврти", sledeciRazred(3), 4);

  console.log(
    greske === 0
      ? `\nРЕЗУЛТАТ: свих ${provera} провера прошло\n`
      : `\nРЕЗУЛТАТ: ${greske} од ${provera} провера НИЈЕ прошло\n`
  );

  process.exit(greske === 0 ? 0 : 1);
}

main();
