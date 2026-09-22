/**
 * Провера рачунице око уплата ученика и исплата менаџерима.
 * Покреће се са: npm run test:obracun
 *
 * Не тражи базу — рачуна се на измишљеним подацима, па је брзо и може
 * да се пусти после сваке измене.
 *
 * Циљ није само "да ли је збир тачан", него и:
 *   - да ли нешто врати NaN (у JSON-у постаје null, па корисник види празно)
 *   - да ли нешто заврши у минусу тамо где минус нема смисла
 *   - да ли исти ученик добија различит дуг на различитим екранима
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
  jednako(
    "20% од 1200 је тачно 240",
    provizijaMenadzera("1200.00", 20),
    240
  );

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

  console.log("\n=== 5. Стање ученика — две формуле ===");

  // Школарина 400, ученик уплатио 100, менаџеру исплаћено 80.
  const a = stanjeUcenika(400, 100, 80, "oduzmi");
  const b = stanjeUcenika(400, 100, 80, "vrati");

  jednako("формула 'oduzmi' (списак и детаљи ученика)", a.preostaliDug, 220);
  jednako("формула 'vrati' (уплате и измена ученика)", b.preostaliDug, 380);
  proveri(
    "исти ученик, различит дуг на различитим екранима",
    a.preostaliDug !== b.preostaliDug,
    `-> ${a.preostaliDug} vs ${b.preostaliDug}`
  );
  jednako(
    "разлика је тачно двострука исплата менаџеру",
    b.preostaliDug - a.preostaliDug,
    160
  );
  jednako(
    "ниједна од две не даје стварни дуг ученика (400 - 100)",
    400 - 100,
    300
  );

  jednako(
    "без исплата менаџеру формуле се поклапају",
    stanjeUcenika(400, 100, 0, "oduzmi").preostaliDug,
    stanjeUcenika(400, 100, 0, "vrati").preostaliDug
  );

  console.log("\n=== 6. Преплата ===");

  const preplata = stanjeUcenika(400, 450, 0, "oduzmi");
  jednako("дуг се не приказује у минусу", preplata.preostaliDug, 0);
  jednako("вишак се води као преплата", preplata.preplata, 50);

  const izmireno = stanjeUcenika(400, 400, 0, "oduzmi");
  jednako("тачно измирено -> дуг 0", izmireno.preostaliDug, 0);
  jednako("тачно измирено -> нема преплате", izmireno.preplata, 0);

  console.log("\n=== 7. Децимале и заокругљивање ===");

  jednako("заокругљивање на две децимале", zaokruziNovac(10.005), 10.01);
  jednako("заокругљивање наниже", zaokruziNovac(10.004), 10);

  // Класичан проблем са зарезом: три рате од 333.33 за школарину од 1000.
  const ostatak = stanjeUcenika(1000, 333.33 * 3, 0, "oduzmi").preostaliDug;
  proveri(
    "три рате од 333.33 остављају ситан дуг (0.01)",
    Math.abs(ostatak - 0.01) < 0.000001,
    `-> ${ostatak}`
  );

  // А овде се види зашто рачун уме да "затрепери": збир 0.1 + 0.2
  const trepet = stanjeUcenika(0.3, 0.1 + 0.2, 0, "oduzmi").stanje;
  proveri(
    "0.1 + 0.2 не даје тачно 0.3, стање остаје ситно негативно",
    trepet !== 0,
    `-> стање ${trepet}`
  );
  jednako(
    "после заокругљивања се не види",
    zaokruziNovac(Math.abs(trepet)),
    0
  );

  console.log("\n=== 8. Пун обрачун ученика ===");

  const o = obracunUcenika(ucenik("400.00", 20, ["100.00", "50.00"], ["30.00"]));
  jednako("укупан дуг", o.ukupanDug, 400);
  jednako("уплаћено", o.uplaceno, 150);
  jednako("исплаћено менаџеру", o.isplacenoMenadzeru, 30);
  jednako("провизија менаџера", o.provizijaMenadzera, 80);
  jednako("преостало менаџеру", o.preostaloMenadzeru, 50);
  jednako("преостали дуг (формула 'oduzmi')", o.preostaliDug, 220);

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

  const beskonacno = stanjeUcenika(400, Infinity, 0, "oduzmi");
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

  // Износи преко опсега decimal(10,2) — база их не би ни примила, али
  // ако се ипак нађу, рачун их прогута без грешке.
  const ogroman = stanjeUcenika(400, 1e308 * 10, 0, "oduzmi");
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

  // Школарина 1200, менаџер 20% (240).
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
  jednako(
    "исплата менаџеру од 240 умањи дуг ученика на 360 (списак ученика)",
    k.preostaliDug,
    360
  );

  const kSaUplate = obracunUcenika(
    ucenik("1200.00", 20, uplate, isplate),
    "vrati"
  );
  jednako(
    "исти тренутак, али екран уплата каже 840",
    kSaUplate.preostaliDug,
    840
  );
  proveri(
    "разлика од 480 на истом ученику, у истом тренутку",
    kSaUplate.preostaliDug - k.preostaliDug === 480
  );

  jednako("менаџеру више ништа не следује", k.preostaloMenadzeru, 0);

  console.log("\n=== 11. Провере при уносу уплате ===");

  // Правило из руте: уплата не сме да пређе `remainingAmount`, а он се
  // рачуна формулом "vrati". Зато исплата менаџеру ПОДИЖЕ горњу границу.
  // Школарина 1200, ученик уплатио 600, менаџеру исплаћено 240.
  const dozvoljeno = obracunUcenika(
    ucenik("1200.00", 20, ["600.00"], ["240.00"]),
    "vrati"
  ).preostaliDug;

  jednako("систем дозвољава уплату до 840", dozvoljeno, 840);
  jednako("а ученик стварно дугује 600", 1200 - 600, 600);
  jednako(
    "разлика је тачно провизија менаџера (240) — одатле „240 више“",
    dozvoljeno - 600,
    240
  );

  // Ако ученик уплати пуних 840, списак ученика га прикаже као преплату.
  const posleMaksimalne = obracunUcenika(
    ucenik("1200.00", 20, ["600.00", "840.00"], ["240.00"])
  );
  jednako("после такве уплате списак приказује дуг 0", posleMaksimalne.preostaliDug, 0);
  jednako("и преплату од 480", posleMaksimalne.preplata, 480);

  // Највећи износ на који сме да се измени постојећа рата.
  jednako(
    "измена рате: дуг 1200, менаџеру 0, остале рате 400 -> највише 800",
    maksimalnaIzmenaUplate(1200, 0, 400),
    800
  );
  jednako(
    "измена рате уз исплату менаџеру подиже границу за тај износ",
    maksimalnaIzmenaUplate(1200, 240, 400),
    1040
  );
  proveri(
    "ако су остале рате већ преко дуга, граница испадне негативна",
    maksimalnaIzmenaUplate(1200, 0, 1500) === -300,
    `-> ${maksimalnaIzmenaUplate(1200, 0, 1500)}`
  );

  console.log("\n=== 12. Читање износа из захтева (parseFloat) ===");

  // Руте примају износ преко parseFloat и проверавају само isNaN и <= 0.
  const procitaj = (v: any) => parseFloat(v);

  jednako("'100.50' се чита исправно", procitaj("100.50"), 100.5);
  jednako("' 100 ' са размацима пролази", procitaj(" 100 "), 100);
  jednako(
    "'50abc' пролази као 50 — слово се тихо одбаци",
    procitaj("50abc"),
    50
  );
  jednako(
    "'1e5' пролази као 100000",
    procitaj("1e5"),
    100000
  );
  jednako("'100,50' се чита као 100 — зарез одсеца децимале", procitaj("100,50"), 100);
  proveri("'abc' даје NaN, рута га одбија", Number.isNaN(procitaj("abc")));
  proveri("празан стринг даје NaN, рута га одбија", Number.isNaN(procitaj("")));
  proveri("null даје NaN, рута га одбија", Number.isNaN(procitaj(null)));
  proveri(
    "'Infinity' прође проверу isNaN и > 0",
    procitaj("Infinity") === Infinity &&
      !Number.isNaN(procitaj("Infinity")) &&
      procitaj("Infinity") > 0
  );
  proveri(
    "али га заустави провера да не прелази дуг",
    procitaj("Infinity") > 1200
  );
  jednako(
    "више децимала се не заокругљује при упису",
    procitaj("100.999"),
    100.999
  );

  console.log(
    greske === 0
      ? `\nРЕЗУЛТАТ: свих ${provera} провера прошло\n`
      : `\nРЕЗУЛТАТ: ${greske} од ${provera} провера НИЈЕ прошло\n`
  );

  process.exit(greske === 0 ? 0 : 1);
}

main();
