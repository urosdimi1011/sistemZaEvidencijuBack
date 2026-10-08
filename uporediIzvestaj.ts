/**
 * Privremeno poređenje: stari godišnji izveštaj protiv novog, nad istim
 * podacima. Samo čita. Obrisati posle.
 */
import { AppDataSource } from "./src/data-source";
import { Student } from "./src/entity/Student";
import { Payment } from "./src/entity/Payment";
import { ManagerPayment } from "./src/entity/ManagerPayment";
import { School } from "./src/entity/School";
import { napraviGodisnjiIzvestaj } from "./src/utiles/godisnjiIzvestaj";
import {
  getSchoolYearRange,
  getSchoolYearLabel,
  getSchoolYearForDate,
} from "./src/utiles/schoolYear";

const n = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x));

async function main() {
  await AppDataSource.initialize();
  const studentRepo = AppDataSource.getRepository(Student);
  const paymentRepo = AppDataSource.getRepository(Payment);
  const managerPaymentRepo = AppDataSource.getRepository(ManagerPayment);
  const schoolRepo = AppDataSource.getRepository(School);

  const raspon = await studentRepo
    .createQueryBuilder("s")
    .select("MIN(s.createdAt)", "min")
    .addSelect("MAX(s.createdAt)", "max")
    .getRawOne();

  const prva = getSchoolYearForDate(new Date(raspon.min));
  const posl = getSchoolYearForDate(new Date(raspon.max));

  for (let godina = prva; godina <= posl; godina++) {
    const { start: od, end: doDatum } = getSchoolYearRange(godina);

    // ── STARO: uplate/isplate/literatura po NOVČANOM TOKU u periodu ──
    const uplateStaro = await paymentRepo
      .createQueryBuilder("p")
      .leftJoin("p.student", "s")
      .leftJoin("s.occupation", "o")
      .leftJoin("o.school", "sc")
      .select("sc.id", "schoolId")
      .addSelect("SUM(p.amount)", "iznos")
      .where("p.paidAt BETWEEN :od AND :doDatum", { od, doDatum })
      .groupBy("sc.id")
      .getRawMany();

    const isplateStaro = await managerPaymentRepo
      .createQueryBuilder("mp")
      .leftJoin("mp.student", "s")
      .leftJoin("s.occupation", "o")
      .leftJoin("o.school", "sc")
      .select("sc.id", "schoolId")
      .addSelect("SUM(mp.amount)", "iznos")
      .where("mp.paidAt BETWEEN :od AND :doDatum", { od, doDatum })
      .groupBy("sc.id")
      .getRawMany();

    const literaturaStaro = await studentRepo
      .createQueryBuilder("s")
      .leftJoin("s.occupation", "o")
      .leftJoin("o.school", "sc")
      .select("sc.id", "schoolId")
      .addSelect("SUM(s.literature)", "iznos")
      .where("s.literaturePaidAt BETWEEN :od AND :doDatum", { od, doDatum })
      .groupBy("sc.id")
      .getRawMany();

    const zbirStaro = (niz: any[]) =>
      niz.reduce((z, r) => z + Number(r.iznos || 0), 0);

    const uplacenoStaro = zbirStaro(uplateStaro);
    const isplacenoStaro = zbirStaro(isplateStaro);
    const literaturaStaroZbir = zbirStaro(literaturaStaro);
    const netoStaro = uplacenoStaro - isplacenoStaro;

    // ── NOVO ────────────────────────────────────────────────────────
    const novo = await napraviGodisnjiIzvestaj(
      { studentRepo, paymentRepo, managerPaymentRepo, schoolRepo },
      godina
    );
    const u = novo.ukupno;

    if (u.brojUpisanih === 0 && uplacenoStaro === 0) continue;

    console.log(`\n${"=".repeat(64)}`);
    console.log(`ШКОЛСКА ${getSchoolYearLabel(godina)}`);
    console.log("=".repeat(64));

    console.log("\nГОРЊА КАРТИЦА");
    console.log(`  Задужено              ${n(u.zaduzeno).padStart(14)}   (исто)`);
    console.log(`  Наплаћено             ${n(u.naplaceno).padStart(14)}   (исто)`);
    console.log(
      `  За наплату            ${n(u.preostaloZaNaplatu).padStart(14)}   (исто)`
    );
    console.log(
      `  Исплаћено менаџерима  ${n(u.isplacenoMenadzerima).padStart(14)}   НОВО`
    );
    console.log(`  Нето                  ${n(u.neto).padStart(14)}   НОВО`);

    console.log("\nДОЊА ТАБЕЛА, ред УКУПНО");
    console.log("  колона                      ПРЕ              САДА      разлика");
    console.log(
      `  Број ученика       ${String(u.brojUpisanih).padStart(13)} ${String(
        u.brojUpisanih
      ).padStart(17)}            0`
    );
    console.log(
      `  Уплаћено/Наплаћено ${n(uplacenoStaro).padStart(13)} ${n(
        u.naplaceno
      ).padStart(17)} ${n(u.naplaceno - uplacenoStaro).padStart(12)}`
    );
    console.log(
      `  Менаџери           ${n(isplacenoStaro).padStart(13)} ${n(
        u.isplacenoMenadzerima
      ).padStart(17)} ${n(u.isplacenoMenadzerima - isplacenoStaro).padStart(12)}`
    );
    console.log(
      `  Нето               ${n(netoStaro).padStart(13)} ${n(u.neto).padStart(
        17
      )} ${n(u.neto - netoStaro).padStart(12)}`
    );
    console.log(
      `  Литература         ${n(literaturaStaroZbir).padStart(13)} ${n(
        u.literaturaNaplacena
      ).padStart(17)} ${n(u.literaturaNaplacena - literaturaStaroZbir).padStart(
        12
      )}`
    );
    console.log(
      `  Задужење           ${"—".padStart(13)} ${n(u.zaduzeno).padStart(
        17
      )}         НОВО`
    );
    console.log(
      `  За наплату         ${"—".padStart(13)} ${n(
        u.preostaloZaNaplatu
      ).padStart(17)}         НОВО`
    );
  }

  await AppDataSource.destroy();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
