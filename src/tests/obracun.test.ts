/**
 * Провера рачунице око уплата ученика и исплата менаџерима.
 * Покреће се са: npm run test:obracun
 *
 * Не тражи базу — рачуна се на измишљеним подацима, па је брзо и може
 * да се пусти после сваке измене.
 *
 * Основно правило које се овде брани:
 *
 *      дуг ученика = школарина − уплаћено
 *
 * Провизија менаџера је трошак школе и НЕ улази у дуг ученика. Раније
 * је улазила, и то са супротним знаком на различитим екранима — због
 * чега је систем дозвољавао да се упише више него што ученик дугује.
 */
import {
  saberiIznose,
  ukupanDug,
  provizijaMenadzera,
  preostaloMenadzeru,
  stanjeUcenika,
  zaokruziNovac,
  obracunUcenika,
  maksimalnaIzmenaUplate,
  GreskaObracuna,
} from "../utiles/obracun";

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

/** Помоћник: ученик какав стиже из базе (decimal колоне су стрингови). */
function ucenik(
  cena: any,
  procenat: any,
  uplate: any[] = [],
  isplate: any[] = []
) {
  return {
    cenaSkolarine: cena,
    procenatManagera: procenat,
    payments: uplate.map((a) => ({ amount: a })),
    managerPayouts: isplate.map((a) => ({ amount: a })),
  };
}

function main() {
  console.log("\n=== 1. Сабирање износа ===");

  jednako("празна листа даје 0", saberiIznose([]), 0);
  jednako(
    "Postgres враћа decimal као стринг",
    saberiIznose([{ amount: "100.50" }, { amount: "200.25" }]),
    300.75
  );
  jednako(
    "мешани типови (број и стринг)",
    saberiIznose([{ amount: 100 }, { amount: "50.50" }]),
    150.5
  );
  jednako("null износ се рачуна као 0", saberiIznose([{ amount: null }]), 0);

  let puklo = false;
  try {
    saberiIznose(undefined, "уплате ученика");
  } catch (e) {
    puklo = e instanceof GreskaObracuna;
  }
  proveri(
    "неучитана релација пуца са јасном поруком, не враћа тиху нулу",
    puklo
  );

  console.log("\n=== 2. Укупан дуг (литература се води одвојено) ===");

  jednako("школарина као стринг", ukupanDug("400.00"), 400);
  jednako("школарина као број", ukupanDug(400), 400);
  jednako("школарина null даје 0", ukupanDug(null), 0);
  proveri(
    "школарина undefined даје NaN — овако дуг стиже празан на екран",
    Number.isNaN(ukupanDug(undefined))
  );

  console.log("\n=== 3. Провизија менаџера ===");

  jednako("20% од 400", provizijaMenadzera("400.00", 20), 80);
  jednako("0% даје 0", provizijaMenadzera("400.00", 0), 0);
  jednako("проценат null даје 0", provizijaMenadzera("400.00", null), 0);
  jednako(
    "проценат undefined даје 0 (не NaN)",
    provizijaMenadzera("400.00", undefined),
    0
  );
  jednako("проценат као стринг '20'", provizijaMenadzera("400.00", "20"), 80);
  jednako("20% од 1200 је тачно 240", provizijaMenadzera("1200.00", 20), 240);

  console.log("\n=== 4. Преостало менаџеру ===");

  jednako("исплаћено мање од провизије", preostaloMenadzeru(80, 30), 50);
  jednako("исплаћено у целости", preostaloMenadzeru(80, 80), 0);

  // Овако се ученику обрише проценат пошто је менаџеру већ исплаћено:
  // провизија падне на 0, а исплате остају, па приказ оде у минус.
  jednako(
    "проценат обрисан после исплате -> приказ у минусу",
    preostaloMenadzeru(provizijaMenadzera("1200.00", null), 240),
    -240
  );
  jednako(
    "иста ситуација, али при исплати се ограничава на 0",
    preostaloMenadzeru(provizijaMenadzera("1200.00", null), 240, true),
    0
  );

  console.log("\n=== 5. Дуг ученика не зависи од исплата менаџеру ===");

  jednako("школарина 400, уплаћено 100 -> дугује 300", stanjeUcenika(400, 100).preostaliDug, 300);
  jednako("нов ученик дугује целу школарину", stanjeUcenika(400, 0).preostaliDug, 400);
  jednako("све измирено", stanjeUcenika(400, 400).preostaliDug, 0);

  // Ово је суштина исправке: исплата менаџеру се више нигде не меша у дуг.
  const bezIsplate = obracunUcenika(ucenik("400.00", 20, ["100.00"], []));
  const saIsplatom = obracunUcenika(ucenik("400.00", 20, ["100.00"], ["80.00"]));
  jednako("без исплате менаџеру ученик дугује 300", bezIsplate.preostaliDug, 300);
  jednako("са исплатом од 80 ученик и даље дугује 300", saIsplatom.preostaliDug, 300);
  proveri(
    "исплата менаџеру НЕ мења дуг ученика",
    bezIsplate.preostaliDug === saIsplatom.preostaliDug
  );
  jednako(
    "али мења колико менаџеру још следује",
    saIsplatom.preostaloMenadzeru,
    0
  );
  jednako("док без исплате менаџеру следује 80", bezIsplate.preostaloMenadzeru, 80);

  console.log("\n=== 6. Преплата ===");

  const preplata = stanjeUcenika(400, 450);
  jednako("дуг се не приказује у минусу", preplata.preostaliDug, 0);
  jednako("вишак се води као преплата", preplata.preplata, 50);

  const izmireno = stanjeUcenika(400, 400);
  jednako("тачно измирено -> дуг 0", izmireno.preostaliDug, 0);
  jednako("тачно измирено -> нема преплате", izmireno.preplata, 0);

  console.log("\n=== 7. Децимале и заокругљивање ===");

  jednako("заокругљивање на две децимале", zaokruziNovac(10.005), 10.01);
  jednako("заокругљивање наниже", zaokruziNovac(10.004), 10);

  // Класичан проблем са зарезом: три рате од 333.33 за школарину од 1000.
  const ostatak = stanjeUcenika(1000, 333.33 * 3).preostaliDug;
  proveri(
    "три рате од 333.33 остављају ситан дуг (0.01)",
    Math.abs(ostatak - 0.01) < 0.000001,
    `-> ${ostatak}`
  );

  const trepet = stanjeUcenika(0.3, 0.1 + 0.2).stanje;
  proveri(
    "0.1 + 0.2 не даје тачно 0.3, стање остаје ситно негативно",
    trepet !== 0,
    `-> стање ${trepet}`
  );
  jednako("после заокругљивања се не види", zaokruziNovac(Math.abs(trepet)), 0);

  console.log("\n=== 8. Пун обрачун ученика ===");

  const o = obracunUcenika(ucenik("400.00", 20, ["100.00", "50.00"], ["30.00"]));
  jednako("укупан дуг", o.ukupanDug, 400);
  jednako("уплаћено", o.uplaceno, 150);
  jednako("исплаћено менаџеру", o.isplacenoMenadzeru, 30);
  jednako("провизија менаџера", o.provizijaMenadzera, 80);
  jednako("преостало менаџеру", o.preostaloMenadzeru, 50);
  jednako("преостали дуг = 400 − 150", o.preostaliDug, 250);

  const bezMenadzera = obracunUcenika(ucenik("400.00", null, ["100.00"], []));
  jednako("ученик без менаџера — провизија 0", bezMenadzera.provizijaMenadzera, 0);
  jednako("ученик без менаџера — дуг 300", bezMenadzera.preostaliDug, 300);

  const nov = obracunUcenika(ucenik("400.00", 20, [], []));
  jednako("нов ученик дугује целу школарину", nov.preostaliDug, 400);
  jednako("нов ученик нема преплату", nov.preplata, 0);

  console.log("\n=== 9. Гранични и неуредан унос ===");

  const saNaN = obracunUcenika(ucenik(undefined, 20, ["100.00"], []));
  proveri(
    "школарина undefined затрује цео обрачун (NaN)",
    Number.isNaN(saNaN.preostaliDug),
    `-> ${saNaN.preostaliDug}`
  );
  proveri(
    "NaN у JSON-у постаје null — корисник види празну ћелију",
    JSON.parse(JSON.stringify({ x: saNaN.preostaliDug })).x === null
  );

  const sajkica = obracunUcenika(ucenik("400.00", 20, ["сто евра"], []));
  proveri(
    "нечитљив износ у бази затрује збир уплата",
    Number.isNaN(sajkica.uplaceno)
  );

  const beskonacno = stanjeUcenika(400, Infinity);
  jednako("бесконачна уплата -> дуг 0", beskonacno.preostaliDug, 0);
  proveri(
    "бесконачна уплата -> бесконачна преплата",
    beskonacno.preplata === Infinity
  );

  const negativna = obracunUcenika(ucenik("400.00", 20, ["-100.00"], []));
  jednako(
    "негативна уплата у бази увећава дуг преко школарине",
    negativna.preostaliDug,
    500
  );

  const ogroman = stanjeUcenika(400, 1e308 * 10);
  proveri(
    "износ преко опсега даје Infinity, без грешке",
    ogroman.preplata === Infinity
  );

  proveri(
    "zaokruziNovac(NaN) остаје NaN, не пуца",
    Number.isNaN(zaokruziNovac(NaN))
  );
  proveri(
    "zaokruziNovac(Infinity) остаје Infinity, не пуца",
    zaokruziNovac(Infinity) === Infinity
  );

  console.log("\n=== 10. Ток кроз више корака ===");

  // Школарина 1200, менаџер 20% (провизија 240).
  let uplate: string[] = [];
  let isplate: string[] = [];

  let k = obracunUcenika(ucenik("1200.00", 20, uplate, isplate));
  jednako("на упису дугује 1200", k.preostaliDug, 1200);
  jednako("менаџеру следује 240", k.provizijaMenadzera, 240);

  uplate = ["600.00"];
  k = obracunUcenika(ucenik("1200.00", 20, uplate, isplate));
  jednako("после уплате од 600 дугује 600", k.preostaliDug, 600);

  isplate = ["240.00"];
  k = obracunUcenika(ucenik("1200.00", 20, uplate, isplate));
  jednako("после исплате менаџеру и даље дугује 600", k.preostaliDug, 600);
  jednako("менаџеру више ништа не следује", k.preostaloMenadzeru, 0);

  uplate = ["600.00", "600.00"];
  k = obracunUcenika(ucenik("1200.00", 20, uplate, isplate));
  jednako("после друге уплате од 600 дуг је 0", k.preostaliDug, 0);
  jednako("и нема преплате", k.preplata, 0);

  console.log("\n=== 11. Провере при уносу уплате ===");

  // Раније је овде била рупа: екран уплата је дозвољавао да се упише
  // онолико више колико је менаџеру исплаћено.
  const saIsplatomMenadzeru = obracunUcenika(
    ucenik("1200.00", 20, ["600.00"], ["240.00"])
  );
  jednako(
    "највише што сме да се уплати је стварни остатак",
    saIsplatomMenadzeru.preostaliDug,
    600
  );
  proveri(
    "исплата менаџеру не подиже горњу границу уплате",
    saIsplatomMenadzeru.preostaliDug ===
      obracunUcenika(ucenik("1200.00", 20, ["600.00"], [])).preostaliDug
  );

  // Ученик из пријаве: школарина 1200, уплаћено 1440. Преплата је 240,
  // не 480 — провизија менаџера се више не рачуна двапут.
  const prijavljeni = obracunUcenika(
    ucenik("1200.00", 20, ["600.00", "840.00"], ["240.00"])
  );
  jednako("преплата је 240, не 480", prijavljeni.preplata, 240);
  jednako("дуг је измирен", prijavljeni.preostaliDug, 0);

  jednako(
    "измена рате: дуг 1200, остале рате 400 -> највише 800",
    maksimalnaIzmenaUplate(1200, 400),
    800
  );
  proveri(
    "ако су остале рате већ преко дуга, граница испадне негативна",
    maksimalnaIzmenaUplate(1200, 1500) === -300,
    `-> ${maksimalnaIzmenaUplate(1200, 1500)}`
  );

  console.log("\n=== 12. Читање износа из захтева (parseFloat) ===");

  const procitaj = (v: any) => parseFloat(v);

  jednako("'100.50' се чита исправно", procitaj("100.50"), 100.5);
  jednako("' 100 ' са размацима пролази", procitaj(" 100 "), 100);
  jednako("'50abc' пролази као 50 — слово се тихо одбаци", procitaj("50abc"), 50);
  jednako("'1e5' пролази као 100000", procitaj("1e5"), 100000);
  jednako(
    "'100,50' се чита као 100 — зарез одсеца децимале",
    procitaj("100,50"),
    100
  );
  proveri("'abc' даје NaN, рута га одбија", Number.isNaN(procitaj("abc")));
  proveri("празан стринг даје NaN, рута га одбија", Number.isNaN(procitaj("")));
  proveri("null даје NaN, рута га одбија", Number.isNaN(procitaj(null)));
  proveri(
    "'Infinity' прође проверу isNaN и > 0",
    procitaj("Infinity") === Infinity && procitaj("Infinity") > 0
  );
  proveri(
    "али га заустави провера да не прелази дуг",
    procitaj("Infinity") > 1200
  );
  jednako("више децимала се не заокругљује при упису", procitaj("100.999"), 100.999);

  console.log(
    greske === 0
      ? `\nРЕЗУЛТАТ: свих ${provera} провера прошло\n`
      : `\nРЕЗУЛТАТ: ${greske} од ${provera} провера НИЈЕ прошло\n`
  );

  process.exit(greske === 0 ? 0 : 1);
}

main();
