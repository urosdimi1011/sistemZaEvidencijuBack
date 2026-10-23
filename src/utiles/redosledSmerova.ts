/**
 * Redosled smerova — jedno mesto za sve.
 *
 * Škole imaju svoj uobičajen poredak koji nije azbučni. Kod medicinske
 * prvo ide medicinska sestra tehničar, pa zubni, pa fizioterapeutski, i
 * tek onda ostali.
 *
 * Pravilo:
 *   1. smerovi sa određenim redosledom, manji broj napred
 *   2. smerovi bez redosleda (nula), po nazivu
 *
 * Time zatečeni smerovi, koji svi imaju nulu, ostaju tačno onako kako
 * su se i do sada prikazivali — azbučno.
 *
 * Koristi se SVUDA gde se smerovi nabrajaju, da se poredak ne bi
 * razlikovao od ekrana do ekrana.
 */

export interface SmerZaPoredak {
  name: string;
  redosled?: number | null;
}

/** Poređenje dva smera; prosleđuje se u `sort`. */
export function uporediSmerove(a: SmerZaPoredak, b: SmerZaPoredak): number {
  const ra = Number(a?.redosled) || 0;
  const rb = Number(b?.redosled) || 0;

  // Neodređeni (nula) idu na kraj
  if (ra !== rb) {
    if (ra === 0) return 1;
    if (rb === 0) return -1;
    return ra - rb;
  }

  return String(a?.name ?? "").localeCompare(String(b?.name ?? ""), "sr");
}

/** Novi niz, poređan. Ulazni niz se ne menja. */
export function poredjaniSmerovi<T extends SmerZaPoredak>(
  smerovi: T[] | null | undefined
): T[] {
  if (!Array.isArray(smerovi)) return [];
  return [...smerovi].sort(uporediSmerove);
}

/**
 * Pretvara spisak id-jeva u redosled 1..n.
 * Šalje se ceo spisak za jednu školu, umesto zamene dva po dva —
 * tako ne može da se desi da dva smera dobiju isti broj.
 */
export function redosledIzSpiska(ids: unknown): Map<number, number> | null {
  if (!Array.isArray(ids) || ids.length === 0) return null;

  const mapa = new Map<number, number>();
  for (let i = 0; i < ids.length; i++) {
    const id = Number(ids[i]);
    if (!Number.isInteger(id) || id <= 0) return null;
    if (mapa.has(id)) return null; // isti smer dvaput
    mapa.set(id, i + 1);
  }
  return mapa;
}
