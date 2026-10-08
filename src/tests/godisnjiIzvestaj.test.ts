/**
 * Провера да ли годишњи извештај тачно рачуна.
 * Покреће се са: npm run test:izvestaj
 *
 * Како се проверава:
 *
 *   Начин А — оно што ради апликација: четири SQL упита са SUM и
 *             GROUP BY по школи.
 *
 *   Начин Б — независно: учитају се СВИ ученици са уплатама и
 *             исплатама, па се збирови рачунају петљом у JavaScript-у.
 *
 * Ако се А и Б поклапају до цента, рачуница је исправна. Исти број
 * добијен на два потпуно различита начина не може бити случајност.
 *
 * Поред тога се проверава и унутрашња доследност извештаја:
 * да ли се ред УКУПНО слаже са збиром редова, да ли је
 * задужење − наплаћено = за наплату, и да ниједан ученик није испао.
 *
 * Ништа се не мења у бази, само се чита.
 */
import { AppDataSource } from "../data-source";
import { Student } from "../entity/Student";
import { Payment } from "../entity/Payment";
import { ManagerPayment } from "../entity/ManagerPayment";
import { School } from "../entity/School";
import { napraviGodisnjiIzvestaj } from "../utiles/godisnjiIzvestaj";
import { getSchoolYearRange, getSchoolYearLabel } from "../utiles/schoolYear";

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

/** Поређење новца — толеранција од пола цента због заокругљивања. */
function istiIznos(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.005;
}

interface ZbirPoSkoli {
  brojUpisanih: number;
  zaduzeno: number;
  naplaceno: number;
  isplacenoMenadzerima: number;
}

async function main() {
  await AppDataSource.initialize();

  const studentRepo = AppDataSource.getRepository(Student);
  const paymentRepo = AppDataSource.getRepository(Payment);
  const managerPaymentRepo = AppDataSource.getRepository(ManagerPayment);
  const schoolRepo = AppDataSource.getRepository(School);

  // Све школске године за које уопште има уписаних ученика
  const raspon = await studentRepo
    .createQueryBuilder("s")
    .select("MIN(s.createdAt)", "min")
    .addSelect("MAX(s.createdAt)", "max")
    .getRawOne();

  const { getSchoolYearForDate } = await import("../utiles/schoolYear");
  const prva = raspon?.min ? getSchoolYearForDate(new Date(raspon.min)) : null;
  const poslednja = raspon?.max
    ? getSchoolYearForDate(new Date(raspon.max))
    : null;

  const godine: number[] = [];
  if (prva !== null && poslednja !== null) {
    for (let g = prva; g <= poslednja; g++) godine.push(g);
  }

  console.log(
    `\nШколске године са подацима: ${godine
      .map((g) => getSchoolYearLabel(g))
      .join(", ")}\n`
  );

  // Сви ученици, једном учитани, са свим уплатама и исплатама
  const sviStudenti = await studentRepo.find({
    relations: ["payments", "managerPayouts", "occupation.school"],
  });
  console.log(`Учитано ученика у меморију: ${sviStudenti.length}\n`);

  for (const godina of godine) {
    const oznaka = getSchoolYearLabel(godina);
    console.log(`${"=".repeat(60)}`);
    console.log(`ШКОЛСКА ${oznaka}`);
    console.log(`${"=".repeat(60)}`);

    // ── Начин А: оно што ради апликација ───────────────────────────
    const izvestaj = await napraviGodisnjiIzvestaj(
      { studentRepo, paymentRepo, managerPaymentRepo, schoolRepo },
      godina
    );

    // ── Начин Б: независно рачунање петљом ─────────────────────────
    const { start: od, end: doDatum } = getSchoolYearRange(godina);
    const uGodini = sviStudenti.filter((s) => {
      const d = new Date(s.createdAt).getTime();
      return d >= od.getTime() && d <= doDatum.getTime();
    });

    const rucno = new Map<string, ZbirPoSkoli>();
    for (const s of uGodini) {
      const kljuc = s.occupation?.school?.name ?? "Без додељене школе";
      if (!rucno.has(kljuc)) {
        rucno.set(kljuc, {
          brojUpisanih: 0,
          zaduzeno: 0,
          naplaceno: 0,
          isplacenoMenadzerima: 0,
        });
      }
      const r = rucno.get(kljuc)!;
      r.brojUpisanih += 1;
      r.zaduzeno += Number(s.cenaSkolarine);
      for (const p of s.payments ?? []) r.naplaceno += Number(p.amount);
      for (const i of s.managerPayouts ?? []) {
        r.isplacenoMenadzerima += Number(i.amount);
      }
    }

    // ── Испис табеле како је корисник види ─────────────────────────
    console.log(
      "\n  школа                                 бр.    задужење    наплаћено   за наплату    менаџери        нето"
    );
    for (const red of izvestaj.schools) {
      if (red.brojUpisanih === 0) continue;
      console.log(
        `  ${red.schoolName.slice(0, 34).padEnd(34)} ${String(
          red.brojUpisanih
        ).padStart(5)} ${novac(red.zaduzeno).padStart(11)} ${novac(
          red.naplaceno
        ).padStart(12)} ${novac(red.preostaloZaNaplatu).padStart(12)} ${novac(
          red.isplacenoMenadzerima
        ).padStart(11)} ${novac(red.neto).padStart(11)}`
      );
    }
    const u = izvestaj.ukupno;
    console.log(
      `  ${"УКУПНО".padEnd(34)} ${String(u.brojUpisanih).padStart(5)} ${novac(
        u.zaduzeno
      ).padStart(11)} ${novac(u.naplaceno).padStart(12)} ${novac(
        u.preostaloZaNaplatu
      ).padStart(12)} ${novac(u.isplacenoMenadzerima).padStart(11)} ${novac(
        u.neto
      ).padStart(11)}`
    );

    // ── 1. Поређење А и Б, школа по школа ──────────────────────────
    console.log("\n  --- 1. SQL збир = ручни збир, по школама ---");

    for (const red of izvestaj.schools) {
      const r = rucno.get(red.schoolName);
      if (!r) {
        proveri(
          `${red.schoolName}: нема уписаних ни у SQL ни ручно`,
          red.brojUpisanih === 0,
          `-> SQL каже ${red.brojUpisanih}`
        );
        continue;
      }
      proveri(
        `${red.schoolName.slice(0, 30)}: број ученика`,
        red.brojUpisanih === r.brojUpisanih,
        `-> SQL ${red.brojUpisanih}, ручно ${r.brojUpisanih}`
      );
      proveri(
        `${red.schoolName.slice(0, 30)}: задужење`,
        istiIznos(red.zaduzeno, r.zaduzeno),
        `-> SQL ${novac(red.zaduzeno)}, ручно ${novac(r.zaduzeno)}`
      );
      proveri(
        `${red.schoolName.slice(0, 30)}: наплаћено`,
        istiIznos(red.naplaceno, r.naplaceno),
        `-> SQL ${novac(red.naplaceno)}, ручно ${novac(r.naplaceno)}`
      );
      proveri(
        `${red.schoolName.slice(0, 30)}: исплаћено менаџерима`,
        istiIznos(red.isplacenoMenadzerima, r.isplacenoMenadzerima),
        `-> SQL ${novac(red.isplacenoMenadzerima)}, ручно ${novac(
          r.isplacenoMenadzerima
        )}`
      );
    }

    // Ниједна школа из ручног рачуна не сме да фали у извештају
    for (const [naziv, r] of rucno) {
      const postoji = izvestaj.schools.some((x) => x.schoolName === naziv);
      proveri(
        `школа "${naziv.slice(0, 30)}" постоји у извештају`,
        postoji,
        `-> има ${r.brojUpisanih} уписаних, а нема реда`
      );
    }

    // ── 2. Ред УКУПНО = збир редова ────────────────────────────────
    console.log("\n  --- 2. Ред УКУПНО је збир редова ---");

    const zbirRedova = {
      brojUpisanih: izvestaj.schools.reduce((z, r) => z + r.brojUpisanih, 0),
      zaduzeno: izvestaj.schools.reduce((z, r) => z + r.zaduzeno, 0),
      naplaceno: izvestaj.schools.reduce((z, r) => z + r.naplaceno, 0),
      isplacenoMenadzerima: izvestaj.schools.reduce(
        (z, r) => z + r.isplacenoMenadzerima,
        0
      ),
      neto: izvestaj.schools.reduce((z, r) => z + r.neto, 0),
      preostaloZaNaplatu: izvestaj.schools.reduce(
        (z, r) => z + r.preostaloZaNaplatu,
        0
      ),
    };

    proveri("број ученика", u.brojUpisanih === zbirRedova.brojUpisanih);
    proveri("задужење", istiIznos(u.zaduzeno, zbirRedova.zaduzeno));
    proveri("наплаћено", istiIznos(u.naplaceno, zbirRedova.naplaceno));
    proveri(
      "исплаћено менаџерима",
      istiIznos(u.isplacenoMenadzerima, zbirRedova.isplacenoMenadzerima)
    );
    proveri("нето", istiIznos(u.neto, zbirRedova.neto));
    proveri(
      "за наплату",
      istiIznos(u.preostaloZaNaplatu, zbirRedova.preostaloZaNaplatu)
    );

    // ── 3. Унутрашња доследност сваког реда ────────────────────────
    console.log("\n  --- 3. Односи између колона ---");

    let svePovezano = true;
    let svaNeto = true;
    for (const red of [...izvestaj.schools, { ...u, schoolName: "УКУПНО" }]) {
      const ocekivanoZaNaplatu = Math.max(0, red.zaduzeno - red.naplaceno);
      // Ред УКУПНО је збир ограничених вредности, па се не пореди овако
      if (red.schoolName !== "УКУПНО") {
        if (!istiIznos(red.preostaloZaNaplatu, ocekivanoZaNaplatu)) {
          svePovezano = false;
          console.log(
            `       ${red.schoolName}: за наплату ${novac(
              red.preostaloZaNaplatu
            )}, а задужење−наплаћено = ${novac(ocekivanoZaNaplatu)}`
          );
        }
      }
      if (!istiIznos(red.neto, red.naplaceno - red.isplacenoMenadzerima)) {
        svaNeto = false;
        console.log(
          `       ${red.schoolName}: нето ${novac(red.neto)}, а наплаћено−менаџери = ${novac(
            red.naplaceno - red.isplacenoMenadzerima
          )}`
        );
      }
    }
    proveri("за наплату = задужење − наплаћено (по школи)", svePovezano);
    proveri("нето = наплаћено − менаџери (свуда)", svaNeto);

    // ── 4. Ниједан ученик није испао ───────────────────────────────
    console.log("\n  --- 4. Ниједан ученик није испао ---");

    proveri(
      `укупан број ученика у извештају = број уписаних у периоду`,
      u.brojUpisanih === uGodini.length,
      `-> извештај ${u.brojUpisanih}, стварно ${uGodini.length}`
    );

    const ukupnoZaduzenoStvarno = uGodini.reduce(
      (z, s) => z + Number(s.cenaSkolarine),
      0
    );
    proveri(
      "укупно задужење = збир школарина свих уписаних",
      istiIznos(u.zaduzeno, ukupnoZaduzenoStvarno),
      `-> извештај ${novac(u.zaduzeno)}, стварно ${novac(ukupnoZaduzenoStvarno)}`
    );

    // ── 5. Упозорења (нису грешке у рачуну) ────────────────────────
    const preplacene = izvestaj.schools.filter(
      (r) => r.naplaceno > r.zaduzeno && r.brojUpisanih > 0
    );
    if (preplacene.length > 0) {
      console.log("\n  --- Напомена ---");
      console.log(
        `       ${preplacene.length} школа има наплаћено преко задужења.`
      );
      console.log(
        "       Њихов ред 'за наплату' стоји на 0, па збир неће бити једнак"
      );
      console.log("       разлици УКУПНО задужење − УКУПНО наплаћено:");
      for (const p of preplacene) {
        console.log(
          `         ${p.schoolName}: задужење ${novac(p.zaduzeno)}, наплаћено ${novac(
            p.naplaceno
          )}`
        );
      }
      console.log(
        `       УКУПНО задужење − наплаћено = ${novac(
          u.zaduzeno - u.naplaceno
        )}, а колона 'за наплату' = ${novac(u.preostaloZaNaplatu)}`
      );
    }

    console.log("");
  }

  console.log(
    greske === 0
      ? `РЕЗУЛТАТ: свих ${provera} провера прошло\n`
      : `РЕЗУЛТАТ: ${greske} од ${provera} провера НИЈЕ прошло\n`
  );

  await AppDataSource.destroy();
  process.exit(greske === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error("Тест се срушио:", e);
  process.exit(1);
});
