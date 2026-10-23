/**
 * Šta se nudi pri upisu učenika.
 *
 * Smer ili škola koji se više ne upisuju ne mogu da se obrišu — za njima
 * stoji istorija učenika. Zato se GASE: ostaju u bazi i svuda se vide,
 * ali se više ne nude pri upisu novog učenika.
 *
 * Gasi se samo ponuda, nikad prikaz.
 */

export interface StavkaPonude {
  id: number;
  name: string;
  aktivan?: boolean;
}

/**
 * Filtrira ugašene stavke iz ponude.
 *
 * `zadrzi` je stavka koju učenik VEĆ ima. Ona se vraća čak i kad je
 * ugašena — inače bi se kod izmene starog učenika polje ispraznilo i
 * ne bi mogao da se sačuva a da mu se ne promeni smer ili škola.
 *
 * To je najlakše prevideti, a ispolji se tek kad neko otvori starog
 * učenika mesecima kasnije.
 */
export function ponudaZaUpis<T extends StavkaPonude>(
  stavke: T[] | null | undefined,
  zadrzi?: number | null
): T[] {
  if (!Array.isArray(stavke)) return [];

  const zadrzaniId =
    zadrzi === null || zadrzi === undefined || !Number.isFinite(Number(zadrzi))
      ? null
      : Number(zadrzi);

  return stavke.filter(
    (s) => s.aktivan !== false || (zadrzaniId !== null && s.id === zadrzaniId)
  );
}

/** Naziv sa oznakom kad je stavka ugašena. */
export function nazivSaOznakom(
  stavka: StavkaPonude,
  oznaka = "угашен"
): string {
  return stavka.aktivan === false ? `${stavka.name} (${oznaka})` : stavka.name;
}
