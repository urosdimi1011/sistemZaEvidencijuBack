/**
 * Обрачун пуштен преко СТВАРНИХ података из базе.
 * Покреће се са: npm run test:obracun:baza
 *
 * Ради две ствари:
 *
 *  1) Показује којим ученицима се приказани дуг мења сада кад исплата
 *     менаџеру више не улази у дуг ученика — и за колико. Ово је списак
 *     који треба показати наручиоцу пре него што исправка оде уживо.
 *
 *  2) Тражи ученике на којима рачуница даје бесмислен резултат — NaN,
 *     минус тамо где минуса не сме да буде, менаџер исплаћен преко
 *     провизије или преко онога што је ученик уплатио.
 *
 * Не мења ништа у бази, само чита.
 */
import { AppDataSource } from "../data-source";
import { Student } from "../entity/Student";
import {
  obracunUcenika,
  provizijaMenadzera,

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

function novac(x: number): string {
  return Number.isFinite(x) ? x.toFixed(2) : String(x);
}

function ime(s: Student): string {
  return `#${s.id} ${s.ime} ${s.prezime}`;
}

async function main() {
  await AppDataSource.initialize();
  const repo = AppDataSource.getRepository(Student);

  const studenti = await repo.find({
    relations: ["payments", "managerPayouts", "menadzer"],
  });

  console.log(`\nУчитано ученика: ${studenti.length}\n`);

  // ── 1. Шта се мења пошто су формуле уједначене ──────────────────────
  console.log("=== 1. Шта се мења у односу на стари обрачун ===");

  const promenjeni: {
    s: Student;
    staroSpisak: number;
    staroUplate: number;
    novo: number;
  }[] = [];

  for (const s of studenti) {
    // Формуле преписане ДОСЛОВНО из рута, пре исправке:
    const totalPaid = s.payments.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0
    );
    const managerPayouts = s.managerPayouts.reduce(
      (sum, payout) => sum + Number(payout.amount),
      0
    );
    const totalDebt = Number(s.cenaSkolarine);

    // стари списак ученика: дуг − уплаћено − исплаћено
    const staroSpisak = Math.max(0, totalDebt - totalPaid - managerPayouts);
    // стари екран уплата: дуг − (уплаћено − исплаћено)
    const staroUplate = Math.max(0, totalDebt - (totalPaid - managerPayouts));

    const novo = obracunUcenika(s).preostaliDug;

    if (novo !== staroSpisak || novo !== staroUplate) {
      promenjeni.push({ s, staroSpisak, staroUplate, novo });
    }
  }

  if (promenjeni.length === 0) {
    console.log("  OK   ниједном ученику се приказани дуг не мења");
  } else {
    console.log(
      `  !!   ${promenjeni.length} ученика добија другачији приказан дуг`
    );
    const ukupnoPre = promenjeni.reduce((z, p) => z + p.staroSpisak, 0);
    const ukupnoPosle = promenjeni.reduce((z, p) => z + p.novo, 0);
    console.log(
      `       збир дуговања тих ученика: ${novac(ukupnoPre)} -> ${novac(
        ukupnoPosle
      )} €`
    );
    console.log(
      `       разлика: ${novac(ukupnoPosle - ukupnoPre)} €`
    );
    console.log(
      "\n       ученик                      списак    уплате      сада"
    );
    for (const p of promenjeni.slice(0, 20)) {
      console.log(
        `       ${ime(p.s).padEnd(26)} ${novac(p.staroSpisak).padStart(
          8
        )} ${novac(p.staroUplate).padStart(9)} ${novac(p.novo).padStart(9)}`
      );
    }
    if (promenjeni.length > 20) {
      console.log(`       ...још ${promenjeni.length - 20}`);
    }
  }

  proveri(
    "нови обрачун не производи NaN ни на једном ученику",
    studenti.every((s) => !Number.isNaN(obracunUcenika(s).preostaliDug))
  );

  // ── 2. Где рачуница даје бесмислен резултат ─────────────────────────
  console.log("\n=== 2. Аномалије у подацима ===");

  const saNaN: Student[] = [];
  const menadzerUMinusu: Student[] = [];
  const menadzerPrekoProvizije: Student[] = [];
  const menadzerPrekoUplata: Student[] = [];
  const saPreplatom: Student[] = [];
  const bezProcentaSaIsplatom: Student[] = [];

  for (const s of studenti) {
    const o = obracunUcenika(s);

    if (
      Number.isNaN(o.ukupanDug) ||
      Number.isNaN(o.uplaceno) ||
      Number.isNaN(o.isplacenoMenadzeru) ||
      Number.isNaN(o.preostaliDug) ||
      Number.isNaN(o.preostaloMenadzeru)
    ) {
      saNaN.push(s);
    }

    if (o.preostaloMenadzeru < 0) menadzerUMinusu.push(s);
    if (o.isplacenoMenadzeru > o.provizijaMenadzera) {
      menadzerPrekoProvizije.push(s);
    }
    if (o.isplacenoMenadzeru > o.uplaceno) menadzerPrekoUplata.push(s);
    if (o.preplata > 0) saPreplatom.push(s);

    if (!s.procenatManagera && o.isplacenoMenadzeru > 0) {
      bezProcentaSaIsplatom.push(s);
    }

  }

  function izvesti(
    naslov: string,
    lista: Student[],
    opis: (s: Student) => string
  ) {
    if (lista.length === 0) {
      console.log(`  OK   ${naslov}: нема ниједног`);
      return;
    }
    console.log(`  !!   ${naslov}: ${lista.length}`);
    for (const s of lista.slice(0, 5)) {
      console.log(`         ${ime(s)} — ${opis(s)}`);
    }
    if (lista.length > 5) console.log(`         ...још ${lista.length - 5}`);
  }

  izvesti("ученици са NaN у обрачуну", saNaN, (s) => {
    const o = obracunUcenika(s);
    return `школарина=${s.cenaSkolarine}, проценат=${s.procenatManagera}, дуг=${novac(
      o.preostaliDug
    )}`;
  });

  izvesti(
    "менаџеру исплаћено преко провизије",
    menadzerPrekoProvizije,
    (s) => {
      const o = obracunUcenika(s);
      return `провизија ${novac(o.provizijaMenadzera)}, исплаћено ${novac(
        o.isplacenoMenadzeru
      )}`;
    }
  );

  izvesti(
    "проценат обрисан, а исплате остале (приказ оде у минус)",
    bezProcentaSaIsplatom,
    (s) => {
      const o = obracunUcenika(s);
      return `проценат=${s.procenatManagera}, исплаћено ${novac(
        o.isplacenoMenadzeru
      )}, приказује се ${novac(o.preostaloMenadzeru)}`;
    }
  );

  izvesti("приказ 'преостало менаџеру' у минусу", menadzerUMinusu, (s) => {
    const o = obracunUcenika(s);
    return `${novac(o.preostaloMenadzeru)}`;
  });

  izvesti(
    "менаџеру исплаћено више него што је ученик уплатио",
    menadzerPrekoUplata,
    (s) => {
      const o = obracunUcenika(s);
      return `ученик уплатио ${novac(o.uplaceno)}, менаџеру ${novac(
        o.isplacenoMenadzeru
      )}`;
    }
  );

  izvesti("ученици са преплатом", saPreplatom, (s) => {
    const o = obracunUcenika(s);
    return `преплата ${novac(o.preplata)}`;
  });

  // ── 3. Збирна провера ───────────────────────────────────────────────
  console.log("\n=== 3. Збир ===");

  let zbirDuga = 0;
  let zbirUplata = 0;
  let zbirIsplata = 0;
  let zbirProvizija = 0;

  for (const s of studenti) {
    const o = obracunUcenika(s);
    if (Number.isFinite(o.ukupanDug)) zbirDuga += o.ukupanDug;
    if (Number.isFinite(o.uplaceno)) zbirUplata += o.uplaceno;
    if (Number.isFinite(o.isplacenoMenadzeru)) zbirIsplata += o.isplacenoMenadzeru;
    if (Number.isFinite(o.provizijaMenadzera)) zbirProvizija += o.provizijaMenadzera;
  }

  console.log(`  Укупно задужено:        ${novac(zbirDuga)} €`);
  console.log(`  Укупно уплаћено:        ${novac(zbirUplata)} €`);
  console.log(`  Исплаћено менаџерима:   ${novac(zbirIsplata)} €`);
  console.log(`  Провизија по уговору:   ${novac(zbirProvizija)} €`);
  console.log(
    `  Менаџерима још следује: ${novac(zbirProvizija - zbirIsplata)} €`
  );

  proveri("збирови су бројеви, не NaN", Number.isFinite(zbirDuga));
  proveri(
    "менаџерима укупно није исплаћено преко провизије",
    zbirIsplata <= zbirProvizija,
    `-> исплаћено ${novac(zbirIsplata)}, провизија ${novac(zbirProvizija)}`
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
