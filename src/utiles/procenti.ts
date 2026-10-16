/**
 * Koji procenat menadžera sme da se upiše.
 *
 * Dva pravila, zavisno od vrste upisa:
 *
 *  - VANREDNI: menadžer nosi svoj procenat (podrazumevano 20), koji mu
 *    administrator određuje. Nalog škole sme da upiše samo 0% ili tačno
 *    taj procenat — ne bira sam.
 *
 *  - REDOVNI: menadžer dobija fiksnih 10%, i to samo jednom, pri prvom
 *    upisu tog učenika u školu (u koji god razred ulazi). Narednih
 *    godina učenik ide dalje bez menadžera, pa je 0%. Ovde se procenat
 *    menadžera uopšte ne gleda — vrednost je ista za sve.
 *
 * Administrator nije ograničen ni u jednom slučaju.
 */
export const PROCENAT_ZA_REDOVNE = 10;

/** Vrednosti koje nalog škole sme da izabere kod redovnog učenika. */
export const PROCENTI_ZA_REDOVNE = [0, PROCENAT_ZA_REDOVNE];

export interface ProveraProcenta {
  /** Uloga naloga koji šalje zahtev */
  uloga?: string;
  /** 'redovni' | 'vandredni' — vrsta upisa učenika */
  tipUcenika?: unknown;
  /** Procenat koji je stigao iz zahteva */
  procenat: unknown;
  /** Da li je uz učenika izabran menadžer */
  imaMenadzera: boolean;
  /** Procenat koji izabrani menadžer nosi (za vanredne) */
  procenatMenadzera?: number | null;
}

export function jeDozvoljenProcenat(params: ProveraProcenta): boolean {
  const { uloga, tipUcenika, procenat, imaMenadzera, procenatMenadzera } =
    params;

  // Administrator i računovođa biraju slobodno
  if (uloga !== "school_manager") return true;

  // Prazno polje znači "bez procenta"
  if (procenat === null || procenat === undefined || procenat === "") {
    return true;
  }

  const uneti = Number(procenat);
  if (!Number.isFinite(uneti)) return false;

  // Nula je uvek dozvoljena — učenik bez menadžera
  if (uneti === 0) return true;

  // Svaki procenat veći od nule traži menadžera
  if (!imaMenadzera) return false;

  if (tipUcenika === "redovni") {
    return uneti === PROCENAT_ZA_REDOVNE;
  }

  return (
    procenatMenadzera !== null &&
    procenatMenadzera !== undefined &&
    uneti === procenatMenadzera
  );
}
