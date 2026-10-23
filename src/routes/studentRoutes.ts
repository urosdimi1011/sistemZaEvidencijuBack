// src/routes/studentRoutes.ts
// src/routes/studentRoutes.ts
import { Router } from "express";
import { AppDataSource } from "../data-source";
import { Student } from "../entity/Student";
import { Between, FindOptionsWhere, ILike, In, IsNull, Not } from "typeorm";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";
import { object } from "yup";
import { Payment } from "../entity/Payment";
import { ManagerPayment } from "../entity/ManagerPayment";
import { Menadzer } from "../entity/Menadzer";
import { searchVariants } from "../utiles/transliterate";
import {
  buildStudentWhere,
  parsePagination,
  parseSortBy,
  parseSortOrder,
  parseSchoolId,
  parseSearch,
  parseDanOpseg,
  parseRazred,
  parseSchoolYear,
  NAJMANJI_RAZRED,
  NAJVECI_RAZRED,
} from "../utiles/studentFilters";
import {
  getSchoolYearForDate,
  getSchoolYearLabel,
  getSchoolYearRange,
} from "../utiles/schoolYear";
import { obracunUcenika, RELACIJE_ZA_OBRACUN } from "../utiles/obracun";
import { jeDozvoljenProcenat, PROCENAT_ZA_REDOVNE } from "../utiles/procenti";
import { rateZaUcenika, zbirRata } from "../utiles/rateMenadzera";
import {
  razlogPreskakanja,
  sledeciRazred,
  napraviNoviUpis,
  datumUpisaZaGodinu,
  predlozenaCena,
} from "../utiles/prebacivanje";

const router = Router();
const studentiRepo = AppDataSource.getRepository(Student);

// Vrsta upisa koju nalog obrađuje. Samo nalozi škole su vezani za vrstu;
// admin i računovođa vide sve, pa za njih vraća null.
function tipUpisaZaNalog(user: any): "redovni" | "vandredni" | null {
  if (user?.role !== "school_manager") return null;
  return user?.tipUpisa === "redovni" || user?.tipUpisa === "vandredni"
    ? user.tipUpisa
    : null;
}
const paymentRepo = AppDataSource.getRepository(Payment);

router.get("/", async (req, res) => {
  try {
    const requestUser = (req as any).user;

    // Obrada i provera svih parametara je izdvojena u utiles/studentFilters,
    // da bi mogla da se testira i da nevalidan unos ne obori upit
    const { page, limit, offset } = parsePagination(req.query);
    const finalSortBy = parseSortBy(req.query.sortBy);
    const sortOrder = parseSortOrder(req.query.sortOrder);

    // Nevalidan datum se odbija odmah, umesto da se tiho ignoriše
    if (
      typeof req.query.date === "string" &&
      req.query.date.trim() &&
      !parseDanOpseg(req.query.date)
    ) {
      return res
        .status(400)
        .json({ message: "Nevalidan format datuma. Koristite YYYY-MM-DD" });
    }

    const finalWhere = buildStudentWhere({
      search: req.query.search,
      date: req.query.date,
      type: req.query.type,
      razred: req.query.razred,
      schoolId: req.query.schoolId,
      schoolYear: req.query.schoolYear,
      napomena: req.query.napomena,
      user: requestUser,
    });

    const searchTerm = parseSearch(req.query.search);
    const datePicker =
      typeof req.query.date === "string" ? req.query.date.trim() : "";
    const schoolIdTerm = parseSchoolId(req.query.schoolId);

    const order: any = {};
    order[finalSortBy] = sortOrder;
    const [studenti, totalCount] = await studentiRepo.findAndCount({
      where: finalWhere,
      relations: [...RELACIJE_ZA_OBRACUN, "menadzer", "occupation.school"],
      order: order,
      take: limit,
      skip: offset,
    });

    const result = studenti.map((m) => {
      // Literatura se naplaćuje odvojeno i ne ulazi u cenu školovanja.
      // Preplata se ne prikazuje u minusu nego kao izmireno.
      const obracun = obracunUcenika(m);

      return {
        id: m.id,
        ime: m.ime,
        imeRoditelja: m.imeRoditelja,
        prezime: m.prezime,
        datumKreiranja: m?.createdAt,
        type: m?.type,
        entry_type: m?.entry_type,
        razred: m?.razred,
        note: m?.note,
        noteHandled: !!m?.noteHandledAt,
        noteHandledAt: m?.noteHandledAt,
        createdAt: m?.createdAt,
        literature: m.literature ? true : false,
        zanimanje: m.occupation
          ? {
              name: m.occupation?.name,
              id: m.occupation?.id,
            }
          : null,
        cenaSkolarine: m.cenaSkolarine,
        literatureCost: m.literature || 0,
        literaturePaidAt: m.literaturePaidAt,
        literaturePaid: !!m.literaturePaidAt,
        ukupanDug: obracun.ukupanDug,
        // Koliko je učenik do sada uplatio — potrebno nalozima škola da
        // prate naplatu iz samog spiska, bez otvaranja svakog učenika
        uplaceno: obracun.uplaceno,
        preostaliDug: obracun.preostaliDug,
        preostaliDugZaMenadzera: obracun.preostaloMenadzeru,
        procenatMenadzeru: m.procenatManagera,
        menadzer: m.menadzer,
        schoolId: m.occupation?.school?.id,
      };
    });

    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.json({
      data: result,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalItems: totalCount,
        itemsPerPage: limit,
        hasNextPage: hasNextPage,
        hasPrevPage: hasPrevPage,
      },
      filters: {
        search: searchTerm || null,
        date: datePicker || null,
        schoolId: schoolIdTerm,
      },
      sorting: {
        sortBy: finalSortBy,
        sortOrder: sortOrder,
      },
    });
  } catch (error) {
    console.error("Greška pri dobavljanju studenata:", error);
    res
      .status(500)
      .json({ message: "Došlo je do greške pri dobavljanju studenata" });
  }
});

router.get("/stats", async (req, res) => {
  try {
    let schoolIdTerm = (req.query.schoolId as string)?.trim();

    const requestUser = (req as any).user;
    if (requestUser?.role === "school_manager" && requestUser?.schoolId) {
      schoolIdTerm = String(requestUser.schoolId);
    }
    let where: FindOptionsWhere<Student> = {};

    if (schoolIdTerm) {
      where = {
        occupation: {
          school: {
            id: Number(schoolIdTerm),
          },
        },
      };
    }

    // Brojač prati ono što nalog zaista vidi
    const tipUpisaNaloga = tipUpisaZaNalog(requestUser);
    if (tipUpisaNaloga) {
      where.type = tipUpisaNaloga;
    }

    // Broj učenika se računa za IZABRANU školsku godinu (1.9. - 31.8.).
    // Ako godina nije poslata, uzima se tekuća.
    //
    // Ranije se ovde uvek računala tekuća godina, pa je kartica iznad
    // tabele pokazivala 2026/2027 i kad je u filteru izabrana druga
    // godina — izgledalo je kao da filter ne radi.
    const tekucaSkolskaGodina = getSchoolYearForDate(new Date());
    const schoolYearStart =
      parseSchoolYear(req.query.schoolYear) ?? tekucaSkolskaGodina;
    const { start: schoolYearFrom, end: schoolYearTo } =
      getSchoolYearRange(schoolYearStart);

    const totalCount = await studentiRepo.count({
      where: {
        ...where,
        createdAt: Between(schoolYearFrom, schoolYearTo),
      },
      relations: ["occupation.school"],
    });

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayCount = await studentiRepo.count({
      where: {
        ...where,
        createdAt: Between(todayStart, todayEnd),
      },
      relations: ["occupation.school"],
    });

    // Školske godine za koje uopšte ima upisa (za birač iznad табеле)
    const rasponUpisa = await studentiRepo
      .createQueryBuilder("s")
      .select("MIN(s.createdAt)", "min")
      .addSelect("MAX(s.createdAt)", "max")
      .getRawOne();

    // Spisak godina se gradi oko TEKUĆE, ne oko izabrane — inače bi
    // izbor stare godine mogao da izbaci tekuću sa spiska, pa korisnik
    // ne bi imao kako da se vrati.
    const availableSchoolYears: number[] = [];
    if (rasponUpisa?.min && rasponUpisa?.max) {
      const prva = Math.min(
        getSchoolYearForDate(new Date(rasponUpisa.min)),
        schoolYearStart
      );
      const poslednja = Math.max(
        getSchoolYearForDate(new Date(rasponUpisa.max)),
        tekucaSkolskaGodina,
        schoolYearStart
      );
      for (let g = poslednja; g >= prva; g--) availableSchoolYears.push(g);
    } else {
      availableSchoolYears.push(tekucaSkolskaGodina);
    }

    res.json({
      totalStudents: totalCount,
      todayStudents: todayCount,
      schoolYear: getSchoolYearLabel(schoolYearStart),
      schoolYearStart,
      availableSchoolYears,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("Greška pri dobavljanju statistika:", error);
    res
      .status(500)
      .json({ message: "Došlo je do greške pri dobavljanju statistika" });
  }
});

/**
 * Pregled pre prebacivanja u sledeći razred.
 *
 * Mora da stoji PRE rute "/:id", inače bi Express "prebacivanje"
 * protumačio kao id učenika.
 */
router.get("/prebacivanje/pregled", async (req: AuthenticatedRequest, res) => {
  try {
    if (req.user?.role !== "admin") {
      return res.status(403).json({
        message: "Пребацивање генерације може да изврши само администратор",
      });
    }

    const izGodine = parseSchoolYear(req.query.izGodine);
    if (izGodine === null) {
      return res.status(400).json({ message: "Нема школске године" });
    }

    const { start, end } = getSchoolYearRange(izGodine);

    const ucenici = await studentiRepo.find({
      where: {
        type: "redovni",
        createdAt: Between(start, end),
      },
      relations: [...RELACIJE_ZA_OBRACUN, "occupation.school", "prethodniUpis"],
      order: { prezime: "ASC", ime: "ASC" },
    });

    // Ko je od njih već prebačen — gleda se postoji li upis koji
    // pokazuje na njega
    const idUcenika = ucenici.map((u) => u.id);
    const vecPrebaceni = new Set<number>();
    if (idUcenika.length > 0) {
      const naredni = await studentiRepo.find({
        where: { prethodniUpisId: In(idUcenika) },
        select: { id: true, prethodniUpisId: true },
      });
      naredni.forEach((n) => vecPrebaceni.add(Number(n.prethodniUpisId)));
    }

    const spremni: any[] = [];
    const preskoceni: any[] = [];

    for (const u of ucenici) {
      const zaProveru = {
        id: u.id,
        ime: u.ime,
        prezime: u.prezime ?? "",
        imeRoditelja: u.imeRoditelja,
        type: u.type,
        razred: u.razred,
        occupationId: u.occupationId,
        cenaSkolarine: u.cenaSkolarine,
        vecPrebacen: vecPrebaceni.has(u.id),
      };

      const razlog = razlogPreskakanja(zaProveru);
      const obracun = obracunUcenika(u);

      const red = {
        id: u.id,
        ime: u.ime,
        prezime: u.prezime,
        razred: u.razred,
        sledeciRazred: u.razred ? sledeciRazred(Number(u.razred)) : null,
        occupationId: u.occupationId,
        zanimanje: u.occupation?.name ?? "—",
        schoolId: u.occupation?.school?.id ?? null,
        schoolName: u.occupation?.school?.name ?? "Без додељене школе",
        cenaSkolarine: Number(u.cenaSkolarine),
        // Dug se prikazuje da administracija vidi ko nije izmirio
        preostaliDug: obracun.preostaliDug,
        predlozenaCena: predlozenaCena(
          u.occupation?.cena,
          u.cenaSkolarine
        ),
      };

      if (razlog) {
        preskoceni.push({ ...red, razlog });
      } else {
        spremni.push(red);
      }
    }

    res.json({
      izGodine,
      uGodinu: izGodine + 1,
      spremni,
      preskoceni,
      brojSpremnih: spremni.length,
      brojPreskocenih: preskoceni.length,
    });
  } catch (error) {
    console.error("Greška pri pregledu prebacivanja:", error);
    res.status(500).json({ message: "Дошло је до грешке при прегледу" });
  }
});

/**
 * Izvršava prebacivanje. Prima spisak učenika i cenu za svakog, jer
 * administracija cene zadaje po smeru za tu godinu.
 *
 * Sve ide u jednoj transakciji: ili prođu svi, ili nijedan. Generacija
 * prebačena napola bila bi gora od neprebačene.
 */
router.post("/prebacivanje", async (req: AuthenticatedRequest, res) => {
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    if (req.user?.role !== "admin") {
      await queryRunner.rollbackTransaction();
      return res.status(403).json({
        message: "Пребацивање генерације може да изврши само администратор",
      });
    }

    const uGodinu = parseSchoolYear(req.body?.uGodinu);
    if (uGodinu === null) {
      await queryRunner.rollbackTransaction();
      return res.status(400).json({ message: "Нема циљне школске године" });
    }

    const stavke = Array.isArray(req.body?.ucenici) ? req.body.ucenici : null;
    if (!stavke || stavke.length === 0) {
      await queryRunner.rollbackTransaction();
      return res
        .status(400)
        .json({ message: "Није изабран ниједан ученик за пребацивање" });
    }

    const datumUpisa = datumUpisaZaGodinu(uGodinu);
    const napravljeni: number[] = [];
    const odbijeni: { id: number; razlog: string }[] = [];

    for (const stavka of stavke) {
      const id = Number(stavka?.id);
      const cena = Number(stavka?.cena);

      if (!Number.isInteger(id) || id <= 0) {
        odbijeni.push({ id, razlog: "неисправан ученик" });
        continue;
      }
      if (!Number.isFinite(cena) || cena <= 0) {
        odbijeni.push({ id, razlog: "неисправна цена" });
        continue;
      }

      const ucenik = await queryRunner.manager.findOne(Student, {
        where: { id },
      });
      if (!ucenik) {
        odbijeni.push({ id, razlog: "ученик не постоји" });
        continue;
      }

      // Ponovna provera na serveru — spisak je mogao da zastari dok je
      // administracija gledala pregled
      const vecPrebacen = await queryRunner.manager.findOne(Student, {
        where: { prethodniUpisId: id },
        select: { id: true },
      });

      const razlog = razlogPreskakanja({
        id: ucenik.id,
        ime: ucenik.ime,
        prezime: ucenik.prezime ?? "",
        type: ucenik.type,
        razred: ucenik.razred,
        occupationId: ucenik.occupationId,
        vecPrebacen: !!vecPrebacen,
      });

      if (razlog) {
        odbijeni.push({ id, razlog });
        continue;
      }

      const noviPodaci = napraviNoviUpis(
        {
          id: ucenik.id,
          ime: ucenik.ime,
          prezime: ucenik.prezime ?? "",
          imeRoditelja: ucenik.imeRoditelja,
          type: ucenik.type,
          razred: ucenik.razred,
          occupationId: ucenik.occupationId,
        },
        cena,
        datumUpisa
      );

      const novi = queryRunner.manager.create(Student, noviPodaci as any);
      const sacuvan = await queryRunner.manager.save(novi);
      napravljeni.push((sacuvan as any).id);
    }

    if (napravljeni.length === 0) {
      await queryRunner.rollbackTransaction();
      return res.status(400).json({
        message: "Ниједан ученик није пребачен",
        odbijeni,
      });
    }

    await queryRunner.commitTransaction();

    res.status(201).json({
      message: `Пребачено ${napravljeni.length} ученика у школску ${getSchoolYearLabel(
        uGodinu
      )}`,
      brojPrebacenih: napravljeni.length,
      odbijeni,
    });
  } catch (error) {
    await queryRunner.rollbackTransaction();
    console.error("Greška pri prebacivanju generacije:", error);
    res.status(500).json({ message: "Дошло је до грешке при пребацивању" });
  } finally {
    await queryRunner.release();
  }
});

router.get("/:id", async (req, res) => {
  try {
    const studentId = parseInt(req.params.id);
    const student = await studentiRepo.findOne({
      where: { id: studentId },
      relations: [...RELACIJE_ZA_OBRACUN, "occupation.school"],
    });
    if (!student) {
      return res.status(404).json({ message: "Student nije pronađen" });
    }
    
    // Literatura se naplaćuje odvojeno i ne ulazi u cenu školovanja.
    // Dug se ne prikazuje u minusu nego kao izmireno, a višak kao preplata.
    const obracun = obracunUcenika(student);

    const totalDebt = obracun.ukupanDug;
    const totalPaid = obracun.uplaceno;
    const remainingAmount = obracun.preostaliDug;
    const preplata = obracun.preplata;
    const commissionAmount = obracun.provizijaMenadzera;
    const remainingForManager = obracun.preostaloMenadzeru;

    // Rate menadžera — po jedna za svaku uplatu učenika
    const rate = rateZaUcenika(
      student.payments,
      student.managerPayouts,
      student.procenatManagera,
      // Gornja granica: preplata učenika ne sme da naduva proviziju
      obracun.provizijaMenadzera
    );
    const zbir = zbirRata(rate);

    res.json({
      student: {
        id: student.id,
        ime: student.ime,
        prezime: student.prezime,
        imeRoditelja: student.imeRoditelja,
        zanimanje: student.occupation?.id,
        createdAt: student?.createdAt,
        ukupnaSkolarina: student.cenaSkolarine,
        ukupnoMenadzeru: commissionAmount,
        type: student?.type,
        entry_type: student?.entry_type,
        razred: student?.razred,
        note: student?.note,
        noteHandled: !!student?.noteHandledAt,
        noteHandledAt: student?.noteHandledAt,
        literature: student.literature ? true : false,
        literatureCost: student.literature || 0,
        literaturePaidAt: student.literaturePaidAt,
        literaturePaid: !!student.literaturePaidAt,
        preostaloMenadzeru: remainingForManager,
        managerId: student.managerId,
        payments: {
          ukupanDug: totalDebt,
          totalPaid,
          remainingAmount,
          preplata,
          installments: student.payments,
        },
        managerPayments: {
          installments: student.managerPayouts,
        },
        // Menadžer zarađuje svoj procenat od svake uplate učenika.
        // Rate se ne čuvaju u bazi — računaju se, pa uvek prate uplate.
        rateMenadzera: rate,
        zbirRata: zbir,
        schoolId: student.occupation?.school?.id,
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Došlo je do greške pri dobavljanju studenata" });
  }
});

// Administracija škole (school_manager) ne sme sama da određuje procenat —
// dozvoljeno je 0% ili tačno onoliko koliko iznosi procenat izabranog menadžera
/**
 * Razred (1-4) vode samo redovni učenici — i kad kreću u prvi, i kad
 * pređu iz druge škole u bilo koji razred. Vanredni umesto toga imaju
 * tip upisa, pa im razred ostaje prazan.
 *
 * Vraća poruku o grešci ili null ako je unos ispravan.
 */
function proveriRazred(tip: unknown, razred: unknown): string | null {
  if (tip !== "redovni") return null;

  const broj = parseRazred(razred);
  if (broj === null) {
    return `Разред је обавезан за редовне ученике и мора бити између ${NAJMANJI_RAZRED} и ${NAJVECI_RAZRED}`;
  }
  return null;
}

/** Razred koji se zaista upisuje: broj kod redovnih, prazno kod ostalih. */
function razredZaUpis(tip: unknown, razred: unknown): number | null {
  return tip === "redovni" ? parseRazred(razred) : null;
}

/**
 * Pravila su u utiles/procenti, da bi mogla da se testiraju bez baze.
 * Ovde se samo dohvata procenat izabranog menadžera.
 */
async function isValidPercentForSchoolManager(
  req: any,
  procenat: any,
  managerId: any,
  tipUcenika?: unknown
): Promise<boolean> {
  const imaMenadzera = !!managerId;

  // Procenat menadžera treba samo kod vanrednih — kod redovnih je fiksan
  let procenatMenadzera: number | null = null;
  if (imaMenadzera && tipUcenika !== "redovni") {
    const menadzer = await AppDataSource.getRepository(Menadzer).findOne({
      where: { id: Number(managerId) },
    });
    procenatMenadzera = menadzer ? menadzer.procenat : null;
  }

  return jeDozvoljenProcenat({
    uloga: req.user?.role,
    tipUcenika,
    procenat,
    imaMenadzera,
    procenatMenadzera,
  });
}

router.post("/", async (req, res) => {
  try {
    // Nalog vezan za vrstu upisa ne bira tip — nameće mu se prema nalogu.
    // Mora se odrediti PRE provere procenta, jer pravilo za redovne
    // (fiksnih 10%) zavisi upravo od vrste upisa.
    const tipUpisaNaloga = tipUpisaZaNalog((req as any).user);
    const tipUcenika = tipUpisaNaloga ?? req.body?.type;

    const dozvoljenProcenat = await isValidPercentForSchoolManager(
      req,
      req.body?.procenatManagera,
      req.body?.managerId,
      tipUcenika
    );
    if (!dozvoljenProcenat) {
      return res.status(400).json({
        error: {
          detail:
            tipUcenika === "redovni"
              ? `Procenat kod redovnih učenika može biti 0% ili ${PROCENAT_ZA_REDOVNE}%`
              : "Procenat mora biti 0% ili procenat koji je određen za izabranog menadžera",
        },
      });
    }

    const dataForSend: any = object(req.body).fields;

    // Redovni učenici nemaju tip upisa ni literaturu.
    if (tipUpisaNaloga) {
      dataForSend.type = tipUpisaNaloga;
    }
    if (dataForSend.type === "redovni") {
      dataForSend.entry_type = null;
      dataForSend.literature = null;
    }

    // Razred je obavezan kod redovnih, a kod vanrednih se ne vodi
    const greskaRazreda = proveriRazred(dataForSend.type, dataForSend.razred);
    if (greskaRazreda) {
      return res.status(400).json({ error: { detail: greskaRazreda } });
    }
    dataForSend.razred = razredZaUpis(dataForSend.type, dataForSend.razred);

    const datum = dataForSend.createdAt as unknown as string;
    const podaciZaUpis = {
      ...dataForSend,
      literature: dataForSend.literature ? 50 : null,
      createdAt: dataForSend.createdAt ? new Date(datum) : new Date(),
    } as Student;
    const novi = studentiRepo.create(podaciZaUpis);
    const sacuvan = await studentiRepo.save(novi);
    let studentSaMenadzerom = await studentiRepo.findOne({
      where: { id: sacuvan.id },
      relations: [...RELACIJE_ZA_OBRACUN, "menadzer", "occupation.school"],
    });

    if (!studentSaMenadzerom) {
      return res.status(404).json({ message: "Student nije pronađen" });
    }

    // Literatura se naplaćuje odvojeno i ne ulazi u cenu školovanja
    const preostaliDug = obracunUcenika(studentSaMenadzerom).preostaliDug;

    const result = {
      id: studentSaMenadzerom.id,
      ime: studentSaMenadzerom.ime,
      prezime: studentSaMenadzerom.prezime,
      datumKreiranja: studentSaMenadzerom?.createdAt,
      type: studentSaMenadzerom?.type,
      entry_type: studentSaMenadzerom?.entry_type,
      note: studentSaMenadzerom?.note,
      literature: studentSaMenadzerom.literature ? true : false,
      literatureCost: studentSaMenadzerom.literature || 0,
      literaturePaidAt: studentSaMenadzerom.literaturePaidAt,
      literaturePaid: !!studentSaMenadzerom.literaturePaidAt,
      imeRoditelja: studentSaMenadzerom.imeRoditelja,
      zanimanje: studentSaMenadzerom.occupation
        ? {
            name: studentSaMenadzerom.occupation.name,
            id: studentSaMenadzerom.occupation.id,
          }
        : null,
      cenaSkolarine: studentSaMenadzerom.cenaSkolarine,
      preostaliDug: preostaliDug,
      procenatMenadzeru: studentSaMenadzerom.procenatManagera,
      menadzer: studentSaMenadzerom.menadzer,
      schoolId: studentSaMenadzerom.occupation?.school?.id,
    };

    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err });
  }
});

router.patch("/:id", async (req, res) => {
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const studentId = parseInt(req.params.id);
    const dataForSend = req.body;

    const currentStudent = await queryRunner.manager.findOne(Student, {
      where: { id: studentId },
      relations: ["managerPayouts"],
    });

    if (!currentStudent) {
      await queryRunner.rollbackTransaction();
      return res.status(404).json({ error: "Student nije pronađen" });
    }

    // Vrsta upisa se mora znati pre provere procenta — kod redovnih važi
    // fiksnih 10%. Ako izmena ne dira tip, uzima se zatečeni.
    const tipUcenikaZaProveru =
      tipUpisaZaNalog((req as any).user) ??
      dataForSend?.type ??
      currentStudent.type;

    const dozvoljenProcenat = await isValidPercentForSchoolManager(
      req,
      dataForSend?.procenatManagera,
      dataForSend?.managerId ?? currentStudent.managerId,
      tipUcenikaZaProveru
    );
    if (!dozvoljenProcenat) {
      await queryRunner.rollbackTransaction();
      return res.status(400).json({
        error: {
          detail:
            tipUcenikaZaProveru === "redovni"
              ? `Procenat kod redovnih učenika može biti 0% ili ${PROCENAT_ZA_REDOVNE}%`
              : "Procenat mora biti 0% ili procenat koji je određen za izabranog menadžera",
        },
      });
    }

    const managerChanging =
      dataForSend.managerId !== undefined &&
      currentStudent.managerId !== dataForSend.managerId;

    if (managerChanging && currentStudent.managerPayouts.length > 0) {
      if (!req.query.confirmDeletePayouts) {
        await queryRunner.rollbackTransaction();
        return res.status(409).json({
          message:
            "Student ima isplate prethodnom menadžeru. Da li želite da ih obrišete?",
          managerPayouts: currentStudent.managerPayouts,
          needsConfirmation: true,
          totalAmount: currentStudent.managerPayouts.reduce(
            (sum, p) => sum + Number(p.amount),
            0
          ),
        });
      }

      await queryRunner.manager.delete(ManagerPayment, {
        studentId: studentId,
      });
    }

    if ([null, undefined, ""].includes(dataForSend.managerId)) {
      dataForSend.managerId = null;
    }
    if ([null, undefined, ""].includes(dataForSend.procenatManagera)) {
      dataForSend.procenatManagera = null;
    }

    if([null,""].includes(dataForSend.createdAt)){
      delete dataForSend.createdAt;
    }

    // Prazno ime roditelja se čuva kao NULL (polje je opciono)
    if (dataForSend.imeRoditelja === "") {
      dataForSend.imeRoditelja = null;
    }

    // Izmenjena napomena se ponovo smatra neobrađenom, da nova poruka
    // menadžera ne bi ostala neprimećena pod ranije skinutom oznakom
    if (
      dataForSend.note !== undefined &&
      (dataForSend.note || null) !== (currentStudent.note || null)
    ) {
      dataForSend.noteHandledAt = null;
    }

    // Nalog vezan za vrstu upisa ne može da promeni tip učenika
    const tipUpisaNalogaZaIzmenu = tipUpisaZaNalog((req as any).user);
    if (tipUpisaNalogaZaIzmenu) {
      dataForSend.type = tipUpisaNalogaZaIzmenu;
    }
    if (dataForSend.type === "redovni") {
      dataForSend.entry_type = null;
      dataForSend.literature = null;
    }

    // Razred je obavezan kod redovnih, a kod vanrednih se ne vodi.
    // Proverava se samo kad je polje uopšte poslato, da izmena jednog
    // drugog podatka ne bi pala zbog razreda koji nije ni diran.
    if (dataForSend.type === "redovni" || dataForSend.razred !== undefined) {
      const tipZaProveru = dataForSend.type ?? currentStudent.type;
      const greskaRazreda = proveriRazred(
        tipZaProveru,
        dataForSend.razred ?? currentStudent.razred
      );
      if (greskaRazreda) {
        await queryRunner.rollbackTransaction();
        await queryRunner.release();
        return res.status(400).json({ error: { detail: greskaRazreda } });
      }
      dataForSend.razred = razredZaUpis(
        tipZaProveru,
        dataForSend.razred ?? currentStudent.razred
      );
    }

    await queryRunner.manager.update(Student, studentId, dataForSend);

    const updatedStudent = await queryRunner.manager.findOne(Student, {
      where: { id: studentId },
      relations: [...RELACIJE_ZA_OBRACUN, "menadzer", "occupation.school"],
    });

    await queryRunner.commitTransaction();

    if (updatedStudent) {
      // Literatura se naplaćuje odvojeno i ne ulazi u cenu školovanja
      const preostaliDug = obracunUcenika(updatedStudent).preostaliDug;

      const result = {
        id: updatedStudent?.id,
        ime: updatedStudent?.ime,
        prezime: updatedStudent.prezime,
        imeRoditelja: updatedStudent.imeRoditelja,
        datumKreiranja: updatedStudent?.createdAt,
        type: updatedStudent?.type,
        entry_type: updatedStudent?.entry_type,
        note: updatedStudent?.note,
        literature: updatedStudent.literature ? true : false,
        literatureCost: updatedStudent.literature || 0,
        literaturePaidAt: updatedStudent.literaturePaidAt,
        literaturePaid: !!updatedStudent.literaturePaidAt,
        zanimanje: updatedStudent.occupation
          ? {
              name: updatedStudent.occupation.name,
              id: updatedStudent.occupation.id,
            }
          : null,
        cenaSkolarine: updatedStudent.cenaSkolarine,
        preostaliDug: preostaliDug,
        procenatMenadzeru: updatedStudent.procenatManagera,
        menadzer: updatedStudent.menadzer,
        schoolId: updatedStudent.occupation?.school?.id,
      };

      res.status(200).json(result);
    } else {
      res.status(200).json([]);
    }
  } catch (err) {
    await queryRunner.rollbackTransaction();
    console.log(err);
    res.status(500).json({ error: "Greška pri ažuriranju studenta" });
  } finally {
    await queryRunner.release();
  }
});

// Administrator označava napomenu kao obrađenu (ili je vraća u neobrađene)
router.patch("/:id/napomena", async (req, res) => {
  try {
    if ((req as any).user?.role !== "admin") {
      return res
        .status(403)
        .json({ message: "Samo administrator može da obradi napomenu" });
    }

    const studentId = parseInt(req.params.id);
    if (isNaN(studentId)) {
      return res.status(400).json({ message: "Nevalidan ID učenika" });
    }

    const student = await studentiRepo.findOne({ where: { id: studentId } });
    if (!student) {
      return res.status(404).json({ message: "Učenik nije pronađen" });
    }

    if (!student.note) {
      return res.status(400).json({ message: "Učenik nema napomenu" });
    }

    const obradjeno = req.body?.obradjeno === true;
    student.noteHandledAt = obradjeno ? new Date() : null;
    await studentiRepo.save(student);

    res.json({
      message: obradjeno
        ? "Napomena je označena kao obrađena"
        : "Napomena je vraćena među neobrađene",
      noteHandled: !!student.noteHandledAt,
      noteHandledAt: student.noteHandledAt,
    });
  } catch (error) {
    console.error("Greška pri obradi napomene:", error);
    res
      .status(500)
      .json({ message: "Došlo je do greške pri obradi napomene" });
  }
});

// Evidencija naplate literature — vodi se odvojeno od školarine
router.patch("/:id/literatura", async (req, res) => {
  try {
    const studentId = parseInt(req.params.id);
    if (isNaN(studentId)) {
      return res.status(400).json({ message: "Nevalidan ID učenika" });
    }

    const student = await studentiRepo.findOne({ where: { id: studentId } });
    if (!student) {
      return res.status(404).json({ message: "Učenik nije pronađen" });
    }

    if (!student.literature) {
      return res
        .status(400)
        .json({ message: "Učenik nije uzeo literaturu" });
    }

    const placeno = req.body?.placeno === true;

    let datumPlacanja: Date | null = null;
    if (placeno) {
      datumPlacanja = req.body?.datum ? new Date(req.body.datum) : new Date();
      if (isNaN(datumPlacanja.getTime())) {
        return res.status(400).json({ message: "Neispravan format datuma." });
      }
    }

    student.literaturePaidAt = datumPlacanja;
    await studentiRepo.save(student);

    res.json({
      message: placeno
        ? "Literatura je evidentirana kao plaćena"
        : "Literatura je evidentirana kao neplaćena",
      literatureCost: student.literature,
      literaturePaid: !!student.literaturePaidAt,
      literaturePaidAt: student.literaturePaidAt,
    });
  } catch (error) {
    console.error("Greška pri evidenciji naplate literature:", error);
    res
      .status(500)
      .json({ message: "Došlo je do greške pri evidenciji naplate literature" });
  }
});

router.delete("/:id", async (req, res) => {
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();

  try {
    const { id } = req.params;

    if (!id || isNaN(parseInt(id))) {
      await queryRunner.rollbackTransaction();
      return res.status(400).json({
        success: false,
        message: "Nevalidan ID studenta",
      });
    }

    const studentId = parseInt(id);

    const student = await queryRunner.manager.findOne(Student, {
      where: { id: studentId } as FindOptionsWhere<Student>,
    });

    if (!student) {
      await queryRunner.rollbackTransaction();
      return res.status(404).json({
        success: false,
        message: "Student nije pronađen",
      });
    }

    const deletePaymentsResult = await queryRunner.manager.delete(Payment, {
      student: { id: studentId },
    });

    console.log(`Obrisano ${deletePaymentsResult.affected} uplata studenta`);

    await queryRunner.manager.remove(Student, student);

    console.log(student);

    await queryRunner.commitTransaction();

    res.status(200).json({
      success: true,
      message: "Student i sve njegove uplate su uspešno obrisani",
      data: {
        id: studentId,
        name: student.ime,
        deletedPaymentsCount: deletePaymentsResult.affected,
      },
    });
  } catch (error: any) {
    await queryRunner.rollbackTransaction();

    console.error("Greška pri brisanju studenta:", error);

    res.status(500).json({
      success: false,
      message: "Došlo je do greške pri brisanju studenta",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  } finally {
    await queryRunner.release();
  }
});

export default router;
