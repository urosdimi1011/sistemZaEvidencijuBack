/**
 * Godišnji izveštaj: jedan red po školi + zbirni red.
 *
 * Ceo izveštaj se vodi po JEDNOJ osnovi: učenici UPISANI u toj školskoj
 * godini (generacija). Sve kolone u redu govore o istim učenicima, pa se
 * zbirovi mogu proveriti sabiranjem.
 *
 * Ranije je red mešao dve osnove — broj upisanih je bio vezan za
 * generaciju, a uplate i isplate za novac koji se kretao u periodu (od
 * bilo kog učenika, i iz ranijih godina). Zato se ništa nije slagalo.
 *
 * Izdvojeno iz rute da bi moglo da se proveri testom:
 * `npm run test:izvestaj` računa isto preko petlje po učenicima i
 * poredi sa ovim, red po red.
 */
import { Repository } from "typeorm";
import { Student } from "../entity/Student";
import { Payment } from "../entity/Payment";
import { ManagerPayment } from "../entity/ManagerPayment";
import { School } from "../entity/School";
import { getSchoolYearRange } from "./schoolYear";

export interface RedIzvestaja {
  schoolId: number;
  schoolName: string;
  brojUpisanih: number;
  zaduzeno: number;
  naplaceno: number;
  brojUplata: number;
  preostaloZaNaplatu: number;
  isplacenoMenadzerima: number;
  brojIsplata: number;
  neto: number;
  literaturaNaplacena: number;
  brojNaplacenihLiteratura: number;
}

export type ZbirIzvestaja = Omit<RedIzvestaja, "schoolId" | "schoolName">;

export interface Izvestaj {
  schools: RedIzvestaja[];
  ukupno: ZbirIzvestaja;
}

export interface RepozitorijumiIzvestaja {
  studentRepo: Repository<Student>;
  paymentRepo: Repository<Payment>;
  managerPaymentRepo: Repository<ManagerPayment>;
  schoolRepo: Repository<School>;
}

function novac(x: number): number {
  return parseFloat(x.toFixed(2));
}

export async function napraviGodisnjiIzvestaj(
  repos: RepozitorijumiIzvestaja,
  schoolYearStart: number
): Promise<Izvestaj> {
  const { studentRepo, paymentRepo, managerPaymentRepo, schoolRepo } = repos;
  const { start: od, end: doDatum } = getSchoolYearRange(schoolYearStart);

  // Koliko je učenika upisano i koliko su ukupno zaduženi
  const upisani = await studentRepo
    .createQueryBuilder("s")
    .leftJoin("s.occupation", "o")
    .leftJoin("o.school", "sc")
    .select("sc.id", "schoolId")
    .addSelect("COUNT(s.id)", "broj")
    .addSelect("SUM(s.cenaSkolarine)", "zaduzeno")
    .where("s.createdAt BETWEEN :od AND :doDatum", { od, doDatum })
    .groupBy("sc.id")
    .getRawMany();

  // Koliko je ta generacija do sada uplatila (bez obzira kada je uplaćeno)
  const naplaceno = await paymentRepo
    .createQueryBuilder("p")
    .leftJoin("p.student", "s")
    .leftJoin("s.occupation", "o")
    .leftJoin("o.school", "sc")
    .select("sc.id", "schoolId")
    .addSelect("SUM(p.amount)", "iznos")
    .addSelect("COUNT(p.id)", "broj")
    .where("s.createdAt BETWEEN :od AND :doDatum", { od, doDatum })
    .groupBy("sc.id")
    .getRawMany();

  // Koliko je menadžerima isplaćeno za tu generaciju
  const isplate = await managerPaymentRepo
    .createQueryBuilder("mp")
    .leftJoin("mp.student", "s")
    .leftJoin("s.occupation", "o")
    .leftJoin("o.school", "sc")
    .select("sc.id", "schoolId")
    .addSelect("SUM(mp.amount)", "iznos")
    .addSelect("COUNT(mp.id)", "broj")
    .where("s.createdAt BETWEEN :od AND :doDatum", { od, doDatum })
    .groupBy("sc.id")
    .getRawMany();

  // Literatura te generacije — naplaćuje se odvojeno i NE ulazi u
  // školarinu, pa ni u neto. Stoji samo kao podatak.
  const literatura = await studentRepo
    .createQueryBuilder("s")
    .leftJoin("s.occupation", "o")
    .leftJoin("o.school", "sc")
    .select("sc.id", "schoolId")
    .addSelect("SUM(s.literature)", "iznos")
    .addSelect("COUNT(s.id)", "broj")
    .where("s.createdAt BETWEEN :od AND :doDatum", { od, doDatum })
    .andWhere("s.literaturePaidAt IS NOT NULL")
    .groupBy("sc.id")
    .getRawMany();

  const nadji = (niz: any[], schoolId: number | null) =>
    niz.find((r) =>
      schoolId === null ? r.schoolId === null : Number(r.schoolId) === schoolId
    );

  const napraviRed = (
    schoolId: number,
    schoolName: string,
    kljuc: number | null
  ): RedIzvestaja => {
    const up = nadji(upisani, kljuc);
    const np = nadji(naplaceno, kljuc);
    const i = nadji(isplate, kljuc);
    const l = nadji(literatura, kljuc);

    const zaduzeno = Number(up?.zaduzeno || 0);
    const naplacenoIznos = Number(np?.iznos || 0);
    const isplacenoIznos = Number(i?.iznos || 0);

    return {
      schoolId,
      schoolName,
      brojUpisanih: Number(up?.broj || 0),
      zaduzeno: novac(zaduzeno),
      naplaceno: novac(naplacenoIznos),
      brojUplata: Number(np?.broj || 0),
      preostaloZaNaplatu: novac(Math.max(0, zaduzeno - naplacenoIznos)),
      isplacenoMenadzerima: novac(isplacenoIznos),
      brojIsplata: Number(i?.broj || 0),
      // Novac koji ostaje školi (za plate profesora)
      neto: novac(naplacenoIznos - isplacenoIznos),
      literaturaNaplacena: Number(l?.iznos || 0),
      brojNaplacenihLiteratura: Number(l?.broj || 0),
    };
  };

  const schools = await schoolRepo.find({ order: { name: "ASC" } });
  const redovi = schools.map((school) =>
    napraviRed(school.id, school.name, school.id)
  );

  // Učenik bez dodeljenog zanimanja (ili zanimanja bez škole) ne upada ni
  // u jedan red iznad, pa bi se tiho izgubio iz izveštaja i zbir se ne bi
  // slagao sa stvarnim brojem upisanih. Zato dobija svoj red.
  const bezSkole = nadji(upisani, null);
  if (bezSkole && Number(bezSkole.broj) > 0) {
    redovi.push(napraviRed(0, "Без додељене школе", null));
  }

  const zbir = (polje: keyof RedIzvestaja) =>
    redovi.reduce((suma, r) => suma + Number(r[polje] || 0), 0);

  // Zbirni red je prost zbir kolona iz tabele — gornja kartica i donja
  // tabela su time po definiciji usklađene.
  return {
    schools: redovi,
    ukupno: {
      brojUpisanih: zbir("brojUpisanih"),
      zaduzeno: novac(zbir("zaduzeno")),
      naplaceno: novac(zbir("naplaceno")),
      brojUplata: zbir("brojUplata"),
      preostaloZaNaplatu: novac(zbir("preostaloZaNaplatu")),
      isplacenoMenadzerima: novac(zbir("isplacenoMenadzerima")),
      brojIsplata: zbir("brojIsplata"),
      neto: novac(zbir("neto")),
      literaturaNaplacena: zbir("literaturaNaplacena"),
      brojNaplacenihLiteratura: zbir("brojNaplacenihLiteratura"),
    },
  };
}
