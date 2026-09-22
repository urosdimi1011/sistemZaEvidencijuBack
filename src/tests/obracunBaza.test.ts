/**
 * Обрачун пуштен преко СТВАРНИХ података из базе.
 * Покреће се са: npm run test:obracun:baza
 *
 * Ради две ствари:
 *
 *  1) Пореди нови модул `utiles/obracun` са формулама онако како су
 *     раније стајале уписане у рутама, ученик по ученик. Ако се игде
 *     разликују, пресељење рачунице је нешто померило и тест пада.
 *
 *  2) Тражи ученике на којима рачуница даје бесмислен резултат — NaN,
 *     минус тамо где минуса не сме да буде, менаџер исплаћен преко
 *     провизије, или различит дуг на различитим екранима.
 *
 * Не мења ништа у бази, само чита.
 */
import { AppDataSource } from "../data-source";
import { Student } from "../entity/Student";
import {
  obracunUcenika,
  provizijaMenadzera,
  stanjeUcenika,
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

  // ── 1. Да ли нови модул рачуна исто што и стари код у рутама ────────
  console.log("=== 1. Пресељена рачуница даје исте бројке ===");

  let razlika = 0;
  let prviPrimer = "";

  for (const s of studenti) {
    // Формуле преписане ДОСЛОВНО из рута, пре пресељења:
    const totalPaid = s.payments.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0
    );
    const managerPayouts = s.managerPayouts.reduce(
      (sum, payout) => sum + Number(payout.amount),
      0
    );
    const totalDebt = Number(s.cenaSkolarine);
    const preostaliDugStaro = Math.max(0, totalDebt - totalPaid - managerPayouts);
    const menadzeruStaro =
      (s.cenaSkolarine as any) * (Number(s.procenatManagera) / 100) -
      managerPayouts;

    const novo = obracunUcenika(s);

    const isti =
      Object.is(novo.uplaceno, totalPaid) &&
      Object.is(novo.isplacenoMenadzeru, managerPayouts) &&
      Object.is(novo.ukupanDug, totalDebt) &&
      Object.is(novo.preostaliDug, preostaliDugStaro) &&
      // једина свесна разлика: код без процента даје NaN, нови даје 0
      (Object.is(novo.preostaloMenadzeru, menadzeruStaro) ||
        (Number.isNaN(menadzeruStaro) && !Number.isNaN(novo.preostaloMenadzeru)));

    if (!isti) {
      razlika++;
      if (!prviPrimer) {
        prviPrimer =
          `${ime(s)}: стари дуг ${novac(preostaliDugStaro)}, ` +
          `нови ${novac(novo.preostaliDug)}; ` +
          `стари менаџеру ${novac(menadzeruStaro)}, ` +
          `нови ${novac(novo.preostaloMenadzeru)}`;
      }
    }
  }

  proveri(
    `нови модул се поклапа са затеченим кодом на свих ${studenti.length} ученика`,
    razlika === 0,
    razlika ? `-> разлика код ${razlika}, нпр. ${prviPrimer}` : ""
  );

  // ── 2. Где рачуница даје бесмислен резултат ─────────────────────────
  console.log("\n=== 2. Аномалије у подацима ===");

  const saNaN: Student[] = [];
  const menadzerUMinusu: Student[] = [];
  const menadzerPrekoProvizije: Student[] = [];
  const menadzerPrekoUplata: Student[] = [];
  const saPreplatom: Student[] = [];
  const neslaganje: { s: Student; a: number; b: number }[] = [];
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

    const a = stanjeUcenika(
      o.ukupanDug,
      o.uplaceno,
      o.isplacenoMenadzeru,
      "oduzmi"
    ).preostaliDug;
    const b = stanjeUcenika(
      o.ukupanDug,
      o.uplaceno,
      o.isplacenoMenadzeru,
      "vrati"
    ).preostaliDug;
    if (a !== b) neslaganje.push({ s, a, b });
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

  // ── 3. Колико ученика добија различит дуг на различитим екранима ────
  console.log("\n=== 3. Неслагање између екрана ===");

  if (neslaganje.length === 0) {
    console.log("  OK   сви ученици имају исти дуг на свим екранима");
  } else {
    const ukupnaRazlika = neslaganje.reduce((z, n) => z + (n.b - n.a), 0);
    console.log(
      `  !!   ${neslaganje.length} ученика има различит дуг у списку и на екрану уплата`
    );
    console.log(
      `       укупна разлика: ${novac(ukupnaRazlika)} € кроз цео систем`
    );
    for (const n of neslaganje.slice(0, 5)) {
      console.log(
        `         ${ime(n.s)} — списак каже ${novac(n.a)}, уплате кажу ${novac(
          n.b
        )}`
      );
    }
    if (neslaganje.length > 5) {
      console.log(`         ...још ${neslaganje.length - 5}`);
    }
  }

  // ── 4. Збирна провера ───────────────────────────────────────────────
  console.log("\n=== 4. Збир ===");

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
