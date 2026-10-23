/**
 * Rate menadžera — koliko mu sledi od svake uplate učenika.
 *
 * Menadžer ne dobija ceo procenat odmah pri upisu, nego ga zarađuje
 * postepeno, onako kako učenik uplaćuje:
 *
 *      školarina 1500, menadžer 20%  ->  ukupno mu sledi 300
 *      učenik uplati  500  ->  menadžeru sledi 100
 *      učenik uplati 1000  ->  menadžeru sledi još 200
 *                              ukupno zarađeno 300
 *
 * Rata se NE upisuje u bazu — računa se iz uplate i procenta, pa uvek
 * prati izmenu uplate. U bazu ide samo zapis o tome da je menadžeru
 * zaista isplaćeno, i taj zapis pokazuje na uplatu koju pokriva.
 *
 * Literatura ne ulazi ni u jedan od ovih iznosa — naplaćuje se odvojeno
 * i menadžer na nju ne dobija ništa. To se postiže time što se procenat
 * računa iz `cenaSkolarine`, u kojoj literature nema.
 */
import { zaokruziNovac } from "./obracun";

export interface UplataUcenika {
  id: number;
  amount: number | string | null;
  paidAt: Date | string;
  note?: string | null;
}

export interface IsplataMenadzeru {
  id: number;
  amount: number | string | null;
  paidAt: Date | string;
  /** Uplata koju ova isplata pokriva; null kod ranije unetih */
  paymentId?: number | null;
}

export interface RataMenadzera {
  /** Uplata učenika iz koje rata nastaje */
  paymentId: number;
  datumUplate: Date | string;
  iznosUplate: number;
  /** Koliko menadžeru sledi od te uplate */
  sledujeMenadzeru: number;
  isplaceno: boolean;
  /** Zapis o isplati, kad postoji */
  isplataId: number | null;
  datumIsplate: Date | string | null;
  /** Stvarno isplaćen iznos — može da se razlikuje ako je procenat
   *  menjan pošto je isplata već evidentirana */
  isplaceniIznos: number | null;
}

/** Procenat od jedne uplate, zaokružen na dve decimale. */
export function rataOdUplate(
  iznosUplate: number | string | null,
  procenat: number | string | null | undefined
): number {
  if (!procenat) return 0;
  const uplata = Number(iznosUplate);
  if (!Number.isFinite(uplata)) return 0;
  return zaokruziNovac(uplata * (Number(procenat) / 100));
}

/**
 * Spisak rata za jednog učenika — po jedna za svaku uplatu, od najnovije.
 *
 * `ukupnaProvizija` je gornja granica: menadžeru ukupno ne može da
 * sledi više od svog procenta na CENU ŠKOLARINE. Bez te granice bi
 * preplata učenika naduvala proviziju — učenik uplati 1800 na školarinu
 * od 1500, i menadžer bi umesto 300 zaradio 360.
 *
 * Granica se troši hronološki, od najstarije uplate. Poslednja uplata
 * koja probije granicu dobija samo ostatak, a one posle nje nulu.
 */
export function rateZaUcenika(
  uplate: UplataUcenika[] | null | undefined,
  isplate: IsplataMenadzeru[] | null | undefined,
  procenat: number | string | null | undefined,
  ukupnaProvizija?: number | null
): RataMenadzera[] {
  if (!Array.isArray(uplate)) return [];

  const poUplati = new Map<number, IsplataMenadzeru>();
  for (const i of isplate ?? []) {
    if (i.paymentId !== null && i.paymentId !== undefined) {
      poUplati.set(Number(i.paymentId), i);
    }
  }

  const granica =
    ukupnaProvizija === null ||
    ukupnaProvizija === undefined ||
    !Number.isFinite(Number(ukupnaProvizija))
      ? Infinity
      : Number(ukupnaProvizija);

  // Računa se od najstarije, da granicu prvo potroše ranije uplate
  const hronoloski = [...uplate].sort(
    (a, b) => new Date(a.paidAt).getTime() - new Date(b.paidAt).getTime()
  );

  let potroseno = 0;
  const rate = hronoloski.map((u) => {
    const puna = rataOdUplate(u.amount, procenat);
    const preostalo = granica - potroseno;
    const rata = puna > 0 ? zaokruziNovac(Math.min(puna, Math.max(0, preostalo))) : puna;
    potroseno = zaokruziNovac(potroseno + rata);

    const isplata = poUplati.get(Number(u.id));
    return {
      paymentId: Number(u.id),
      datumUplate: u.paidAt,
      iznosUplate: zaokruziNovac(Number(u.amount)),
      sledujeMenadzeru: rata,
      isplaceno: !!isplata,
      isplataId: isplata ? Number(isplata.id) : null,
      datumIsplate: isplata ? isplata.paidAt : null,
      isplaceniIznos: isplata ? zaokruziNovac(Number(isplata.amount)) : null,
    };
  });

  // Za prikaz ide od najnovije
  return rate.reverse();
}

export interface ZbirRata {
  /** Zbir svih rata — koliko je menadžer do sada zaradio */
  zaradjeno: number;
  /** Zbir rata koje su označene kao isplaćene */
  isplacenoKrozRate: number;
  /** Koliko mu još sledi po ratama koje nisu isplaćene */
  preostaloPoRatama: number;
  brojRata: number;
  brojIsplacenih: number;
}

export function zbirRata(rate: RataMenadzera[]): ZbirRata {
  let zaradjeno = 0;
  let isplaceno = 0;
  let brojIsplacenih = 0;

  for (const r of rate) {
    zaradjeno += r.sledujeMenadzeru;
    if (r.isplaceno) {
      isplaceno += r.sledujeMenadzeru;
      brojIsplacenih++;
    }
  }

  return {
    zaradjeno: zaokruziNovac(zaradjeno),
    isplacenoKrozRate: zaokruziNovac(isplaceno),
    preostaloPoRatama: zaokruziNovac(zaradjeno - isplaceno),
    brojRata: rate.length,
    brojIsplacenih,
  };
}
