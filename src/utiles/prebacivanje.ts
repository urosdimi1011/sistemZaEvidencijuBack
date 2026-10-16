/**
 * Prebacivanje redovnih učenika u sledeći razred.
 *
 * Redovan učenik se svake školske godine upisuje iznova — svaki upis je
 * svoj zapis, sa svojom cenom i svojim uplatama. U septembru se cela
 * generacija prebacuje: prvi razred postaje drugi, drugi treći, treći
 * četvrti. Četvrti razred se ne prebacuje, ti su završili.
 *
 * Pravila koja ovde važe:
 *
 *  - samo REDOVNI učenici; vanredni se ne prebacuju
 *  - novi upis ide BEZ MENADŽERA i bez procenta — menadžer uzima 10%
 *    samo jednom, pri prvom upisu u školu
 *  - učenik koji je već prebačen ne prebacuje se ponovo
 *  - napomena se ne prenosi; ona se odnosi na prethodnu godinu
 */

export const PRVI_RAZRED = 1;
export const ZAVRSNI_RAZRED = 4;

export interface UcenikZaPrebacivanje {
  id: number;
  ime: string;
  prezime: string;
  imeRoditelja?: string | null;
  type?: string | null;
  razred?: number | null;
  occupationId?: number | null;
  cenaSkolarine?: number | string | null;
  /** Da li već postoji upis koji pokazuje na ovaj */
  vecPrebacen?: boolean;
}

export type RazlogPreskakanja =
  | "nije_redovan"
  | "nema_razred"
  | "zavrsio"
  | "vec_prebacen"
  | "nema_smer";

/**
 * Da li učenik ide dalje, i ako ne — zašto.
 * Razlog se vraća da bi pregled mogao da objasni zašto neko nije na spisku.
 */
export function razlogPreskakanja(
  ucenik: UcenikZaPrebacivanje
): RazlogPreskakanja | null {
  if (ucenik.type !== "redovni") return "nije_redovan";
  if (ucenik.vecPrebacen) return "vec_prebacen";

  const razred = Number(ucenik.razred);
  if (!Number.isInteger(razred) || razred < PRVI_RAZRED) return "nema_razred";
  if (razred >= ZAVRSNI_RAZRED) return "zavrsio";

  if (!ucenik.occupationId) return "nema_smer";

  return null;
}

export function sledeciRazred(razred: number): number {
  return razred + 1;
}

export interface NoviUpis {
  ime: string;
  prezime: string;
  imeRoditelja: string | null;
  occupationId: number;
  razred: number;
  type: "redovni";
  entry_type: null;
  literature: null;
  note: null;
  /** Menadžer ne ide uz prebacivanje — 10% se uzima samo jednom */
  managerId: null;
  procenatManagera: null;
  cenaSkolarine: number;
  createdAt: Date;
  prethodniUpisId: number;
}

/**
 * Pravi zapis za narednu školsku godinu.
 *
 * `cena` se prosleđuje spolja jer je administracija zadaje po smeru za
 * tu godinu — ne preuzima se sa prošlogodišnjeg upisa.
 *
 * `datumUpisa` je 1. septembar ciljne školske godine, da bi učenik upao
 * u pravu godinu u svim izveštajima.
 */
export function napraviNoviUpis(
  ucenik: UcenikZaPrebacivanje,
  cena: number,
  datumUpisa: Date
): NoviUpis {
  const razlog = razlogPreskakanja(ucenik);
  if (razlog) {
    throw new Error(`Ученик #${ucenik.id} се не пребацује: ${razlog}`);
  }

  return {
    ime: ucenik.ime,
    prezime: ucenik.prezime,
    imeRoditelja: ucenik.imeRoditelja ?? null,
    occupationId: Number(ucenik.occupationId),
    razred: sledeciRazred(Number(ucenik.razred)),
    type: "redovni",
    entry_type: null,
    literature: null,
    // Napomena se odnosi na prošlu godinu i ne prenosi se
    note: null,
    managerId: null,
    procenatManagera: null,
    cenaSkolarine: cena,
    createdAt: datumUpisa,
    prethodniUpisId: ucenik.id,
  };
}

/** 1. septembar školske godine koja počinje te godine. */
export function datumUpisaZaGodinu(schoolYearStart: number): Date {
  return new Date(schoolYearStart, 8, 1, 0, 0, 0, 0);
}

/**
 * Cena koja se nudi za smer: ono što je administracija zadala za taj
 * smer, a ako nije zadala ništa — prošlogodišnja cena tog učenika.
 *
 * Nikad se ne vraća nula, jer bi to značilo da je školovanje besplatno.
 */
export function predlozenaCena(
  cenaSmera: number | string | null | undefined,
  prosloGodisnjaCena: number | string | null | undefined
): number | null {
  const smer = Number(cenaSmera);
  if (Number.isFinite(smer) && smer > 0) return smer;

  const proslo = Number(prosloGodisnjaCena);
  if (Number.isFinite(proslo) && proslo > 0) return proslo;

  return null;
}
