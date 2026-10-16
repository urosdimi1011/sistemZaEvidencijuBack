/**
 * Провера правила о проценту менаџера.
 * Покреће се са: npm run test:procenti
 *
 * Два различита правила:
 *
 *   ВАНРЕДНИ — менаџер носи свој проценат (подразумевано 20). Налог
 *              школе сме да упише само 0% или тачно тај проценат.
 *
 *   РЕДОВНИ  — менаџер добија фиксних 10%, без обзира који проценат
 *              носи за ванредне. Налог школе бира између 0 и 10.
 *
 * Администратор није ограничен ни у једном случају.
 *
 * Ово дира новац, зато је покривено и са стране дозволе и са стране
 * забране — да нешто не прође само зато што провера увек враћа тачно.
 */
import {
  jeDozvoljenProcenat,
  PROCENAT_ZA_REDOVNE,
  PROCENTI_ZA_REDOVNE,
} from "../utiles/procenti";

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

/** Налог школе уписује ученика. */
function skola(
  tipUcenika: string,
  procenat: unknown,
  imaMenadzera: boolean,
  procenatMenadzera: number | null = 20
) {
  return jeDozvoljenProcenat({
    uloga: "school_manager",
    tipUcenika,
    procenat,
    imaMenadzera,
    procenatMenadzera,
  });
}

function sme(opis: string, rezultat: boolean) {
  proveri(opis, rezultat === true, "-> одбијено, а смело је");
}

function neSme(opis: string, rezultat: boolean) {
  proveri(opis, rezultat === false, "-> прошло, а није смело");
}

function main() {
  console.log("\n=== 1. Редовни ученици — фиксних 10% ===");

  sme("0% без менаџера", skola("redovni", 0, false));
  sme("0% иако менаџер постоји", skola("redovni", 0, true));
  sme("10% уз менаџера", skola("redovni", 10, true));
  sme("празно поље", skola("redovni", null, false));
  sme("празан стринг", skola("redovni", "", false));

  neSme("10% без менаџера", skola("redovni", 10, false));
  neSme("20% уз менаџера", skola("redovni", 20, true));
  neSme("5% уз менаџера", skola("redovni", 5, true));
  neSme("15% уз менаџера", skola("redovni", 15, true));
  neSme("100% уз менаџера", skola("redovni", 100, true));

  // Кључно: менаџер носи 20 за ванредне, али код редовних то не важи
  sme(
    "менаџер са 20% ипак добија 10% на редовног",
    skola("redovni", 10, true, 20)
  );
  neSme(
    "менаџер са 20% не може да добије 20% на редовног",
    skola("redovni", 20, true, 20)
  );

  console.log("\n=== 2. Ванредни ученици — проценат менаџера ===");

  sme("0% без менаџера", skola("vandredni", 0, false));
  sme("20% уз менаџера који носи 20", skola("vandredni", 20, true, 20));
  sme("30% уз менаџера који носи 30", skola("vandredni", 30, true, 30));

  neSme("10% уз менаџера који носи 20", skola("vandredni", 10, true, 20));
  neSme("20% без менаџера", skola("vandredni", 20, false));
  neSme(
    "менаџер без одређеног процента",
    skola("vandredni", 20, true, null)
  );

  console.log("\n=== 3. Администратор бира слободно ===");

  const admin = (tip: string, procenat: unknown, imaMenadzera = true) =>
    jeDozvoljenProcenat({
      uloga: "admin",
      tipUcenika: tip,
      procenat,
      imaMenadzera,
      procenatMenadzera: 20,
    });

  sme("админ сме 15% на редовног", admin("redovni", 15));
  sme("админ сме 37% на ванредног", admin("vandredni", 37));
  sme("админ сме 0%", admin("redovni", 0, false));
  sme(
    "рачуновођа такође",
    jeDozvoljenProcenat({
      uloga: "racunovodja",
      tipUcenika: "redovni",
      procenat: 15,
      imaMenadzera: true,
    })
  );

  console.log("\n=== 4. Неуредан унос ===");

  neSme("слово уместо броја", skola("redovni", "abc", true));
  neSme("Infinity", skola("redovni", Infinity, true));
  neSme("негативан проценат", skola("redovni", -10, true));
  sme("'10' као стринг", skola("redovni", "10", true));
  sme("'0' као стринг", skola("redovni", "0", false));

  console.log("\n=== 5. Вредности понуђене у форми ===");

  proveri(
    "код редовних постоје тачно две опције",
    PROCENTI_ZA_REDOVNE.length === 2
  );
  proveri("прва је 0", PROCENTI_ZA_REDOVNE[0] === 0);
  proveri(
    `друга је ${PROCENAT_ZA_REDOVNE}`,
    PROCENTI_ZA_REDOVNE[1] === PROCENAT_ZA_REDOVNE
  );
  proveri(
    "свака понуђена вредност заиста пролази проверу",
    PROCENTI_ZA_REDOVNE.every((p) => skola("redovni", p, p !== 0))
  );

  console.log(
    greske === 0
      ? `\nРЕЗУЛТАТ: свих ${provera} провера прошло\n`
      : `\nРЕЗУЛТАТ: ${greske} од ${provera} провера НИЈЕ прошло\n`
  );

  process.exit(greske === 0 ? 0 : 1);
}

main();
