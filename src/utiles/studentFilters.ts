import { Between, FindOptionsWhere, ILike, IsNull, Not } from "typeorm";
import { Student } from "../entity/Student";
import { searchVariants } from "./transliterate";
import { getSchoolYearRange } from "./schoolYear";

/**
 * Obrada parametara za spisak učenika.
 *
 * Sve vrednosti ovde dolaze iz URL-a, dakle od korisnika, i ne sme im se
 * verovati. Cilj je da nevalidan parametar nikad ne stigne do baze — jer
 * npr. NaN ili nepostojeći smer sortiranja obaraju upit i vraćaju grešku 500.
 */

export const DOZVOLJENA_POLJA_SORTIRANJA = [
  "createdAt",
  "ime",
  "prezime",
  "cenaSkolarine",
];

export const DOZVOLJENI_TIPOVI = ["redovni", "vandredni"];

export const MAX_DUZINA_PRETRAGE = 100;
export const MAX_PO_STRANI = 100;

export function parseSortBy(value: unknown): string {
  return typeof value === "string" && DOZVOLJENA_POLJA_SORTIRANJA.includes(value)
    ? value
    : "createdAt";
}

/**
 * Smer sortiranja se ugrađuje u SQL, pa mora da bude sa spiska.
 * Bez ove provere proizvoljan tekst obara upit.
 */
export function parseSortOrder(value: unknown): "ASC" | "DESC" {
  return typeof value === "string" && value.toUpperCase() === "ASC"
    ? "ASC"
    : "DESC";
}

export function parsePagination(query: {
  page?: unknown;
  limit?: unknown;
}): { page: number; limit: number; offset: number } {
  const page = Math.max(1, parseInt(String(query.page ?? ""), 10) || 1);
  const limit = Math.min(
    MAX_PO_STRANI,
    Math.max(1, parseInt(String(query.limit ?? ""), 10) || 20)
  );
  return { page, limit, offset: (page - 1) * limit };
}

/** Vraća ID škole samo ako je stvarno broj; u suprotnom null. */
export function parseSchoolId(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const broj = Number(String(value).trim());
  return Number.isInteger(broj) && broj > 0 ? broj : null;
}

/** Ceo dan za zadati datum, ili null ako datum nije upotrebljiv. */
export function parseDanOpseg(
  value: unknown
): { start: Date; end: Date } | null {
  if (typeof value !== "string" || !value.trim()) return null;

  const datum = new Date(value.trim());
  if (isNaN(datum.getTime())) return null;

  const start = new Date(datum);
  start.setHours(0, 0, 0, 0);
  const end = new Date(datum);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * Početna godina školske godine (2026 = školska 2026/27).
 * Vraća null za "sve godine" i za neupotrebljiv unos.
 */
export function parseSchoolYear(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const tekst = String(value).trim();
  if (tekst === "sve") return null;

  const godina = parseInt(tekst, 10);
  return Number.isInteger(godina) && godina >= 1900 && godina <= 2200
    ? godina
    : null;
}

/** Pretraga se skraćuje — vrlo dugačak unos pravi ogroman OR upit. */
export function parseSearch(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, MAX_DUZINA_PRETRAGE);
}

export interface StudentFilterParams {
  search?: unknown;
  date?: unknown;
  type?: unknown;
  schoolId?: unknown;
  schoolYear?: unknown;
  napomena?: unknown;
  /** Podaci o nalogu koji šalje zahtev (iz tokena) */
  user?: { role?: string; schoolId?: number | null; tipUpisa?: string | null };
}

/**
 * Sklapa uslov za pretragu učenika. Ograničenja naloga (škola, vrsta upisa)
 * imaju prednost nad onim što je stiglo iz URL-a.
 */
export function buildStudentWhere(
  params: StudentFilterParams
): FindOptionsWhere<Student> | FindOptionsWhere<Student>[] {
  const baseWhere: FindOptionsWhere<Student> = {};
  const user = params.user;

  // Nalog škole vidi samo svoju školu, bez obzira šta je poslato
  const schoolIdIzNaloga =
    user?.role === "school_manager" && user?.schoolId ? user.schoolId : null;
  const schoolId = schoolIdIzNaloga ?? parseSchoolId(params.schoolId);

  if (schoolId !== null) {
    baseWhere.occupation = { school: { id: schoolId } };
  }

  // Nalog vezan za vrstu upisa ne bira tip
  const tipIzNaloga =
    user?.role === "school_manager" &&
    typeof user?.tipUpisa === "string" &&
    DOZVOLJENI_TIPOVI.includes(user.tipUpisa)
      ? user.tipUpisa
      : null;

  const tip = typeof params.type === "string" ? params.type.trim() : "";

  if (tipIzNaloga) {
    baseWhere.type = tipIzNaloga as "redovni" | "vandredni";
  } else if (tip === "bez_tipa") {
    baseWhere.type = IsNull();
  } else if (DOZVOLJENI_TIPOVI.includes(tip)) {
    baseWhere.type = tip as "redovni" | "vandredni";
  }

  // Filter po napomeni je samo za administratora
  if (user?.role === "admin") {
    const napomena =
      typeof params.napomena === "string" ? params.napomena.trim() : "";
    if (napomena === "ima") {
      baseWhere.note = Not(IsNull());
    } else if (napomena === "neobradjene") {
      baseWhere.note = Not(IsNull());
      baseWhere.noteHandledAt = IsNull();
    }
  }

  // Konkretan dan je precizniji od školske godine, pa ima prednost
  const danOpseg = parseDanOpseg(params.date);
  if (danOpseg) {
    baseWhere.createdAt = Between(danOpseg.start, danOpseg.end);
  } else {
    const schoolYear = parseSchoolYear(params.schoolYear);
    if (schoolYear !== null) {
      const { start, end } = getSchoolYearRange(schoolYear);
      baseWhere.createdAt = Between(start, end);
    }
  }

  const searchTerm = parseSearch(params.search);
  if (!searchTerm) return baseWhere;

  const terms = searchTerm.split(/\s+/).filter((t) => t.length > 0);
  if (terms.length === 0) return baseWhere;

  const uslovi: FindOptionsWhere<Student>[] = [];

  terms.forEach((term) => {
    searchVariants(term).forEach((variant) => {
      uslovi.push(
        { ...baseWhere, ime: ILike(`%${variant}%`) },
        { ...baseWhere, prezime: ILike(`%${variant}%`) }
      );
    });
  });

  if (terms.length >= 2) {
    for (const v0 of searchVariants(terms[0])) {
      for (const v1 of searchVariants(terms[1])) {
        uslovi.push(
          { ...baseWhere, ime: ILike(`%${v0}%`), prezime: ILike(`%${v1}%`) },
          { ...baseWhere, ime: ILike(`%${v1}%`), prezime: ILike(`%${v0}%`) }
        );
      }
    }
  }

  return uslovi;
}
