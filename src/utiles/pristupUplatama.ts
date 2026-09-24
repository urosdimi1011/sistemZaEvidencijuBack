/**
 * Ko sme šta sa uplatama.
 *
 * Nalozi za upis redovnih učenika sami evidentiraju uplate svojih
 * učenika. Bez provere ispod, takav nalog bi mogao da unese uplatu bilo
 * kom učeniku u sistemu — dovoljno je da pogodi ID u zahtevu, jer URL
 * ne nosi školu.
 */

export interface KorisnikZahteva {
  userId?: number;
  schoolId?: number | null;
  role?: string;
  tipUpisa?: "redovni" | "vandredni" | null;
}

export interface UcenikZaProveru {
  type?: string | null;
  occupation?: { school?: { id?: number } | null } | null;
}

/**
 * Vraća poruku o grešci ako nalog ne sme da radi sa ovim učenikom,
 * ili null ako sme.
 */
export function zabranaPristupaUceniku(
  user: KorisnikZahteva | undefined | null,
  ucenik: UcenikZaProveru | null | undefined
): string | null {
  if (!user) return "Niste autorizovani";

  // Administrator i računovođa rade sa svim učenicima
  if (user.role === "admin" || user.role === "racunovodja") return null;

  if (user.role !== "school_manager") return "Nemate pristup ovoj radnji";
  if (!ucenik) return "Student nije pronađen";

  const schoolId = ucenik.occupation?.school?.id;
  if (!schoolId || schoolId !== user.schoolId) {
    return "Učenik ne pripada vašoj školi";
  }

  // Nalog vezan za vrstu upisa ne sme da dira drugu vrstu
  if (user.tipUpisa && ucenik.type !== user.tipUpisa) {
    return "Učenik nije iz vrste upisa koju vaš nalog obrađuje";
  }

  return null;
}

/**
 * Radnje koje nalozi škola ne izvode: izmena i brisanje već evidentirane
 * uplate, i isplate menadžerima.
 */
export function samoAdminIliRacunovodja(
  user: KorisnikZahteva | undefined | null
): string | null {
  if (user?.role === "admin" || user?.role === "racunovodja") return null;
  return "Ovu radnju može da izvede samo administrator";
}
