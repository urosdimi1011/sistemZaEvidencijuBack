/**
 * Обрачун новца: дуг ученика, преплата и провизија менаџера.
 *
 * Рачуница је до сада стајала преписана на седам места по рутама
 * (studentRoutes, paymantsRoutes, menadzerRoutes). Овде је пресељена
 * ОНАКВА КАКВА ЈЕСТЕ — ниједна формула није промењена — да би могла да
 * се покрије тестовима без покретања сервера.
 *
 * ВАЖНО: у систему постоје ДВЕ различите формуле за стање ученика и обе
 * су задржане, јер дају различит резултат. Види `FormulaStanja` ниже и
 * тест `npm run test:obracun`.
 */

/** Ставка са новчаним износом — уплата ученика или исплата менаџеру. */
export interface NovcanaStavka {
  amount?: number | string | null;
}

/** Грешка у обрачуну коју рута треба да пријави, а не да прећути. */
export class GreskaObracuna extends Error {}

/**
 * Збир износа.
 *
 * Postgres враћа `decimal` колоне као стринг ("400.00"), зато Number().
 *
 * Ако листа уопште није учитана (релација није тражена у упиту), свесно
 * пуцамо уместо да вратимо нулу: тиха нула би приказала да ученик ништа
 * није уплатио и неко би му наплатио двапут.
 */
export function saberiIznose(
  stavke: NovcanaStavka[] | null | undefined,
  opis = "ставке"
): number {
  if (!Array.isArray(stavke)) {
    throw new GreskaObracuna(
      `Обрачун: ${opis} нису учитане (релација недостаје у упиту)`
    );
  }

  let zbir = 0;
  for (const stavka of stavke) {
    zbir += Number(stavka?.amount);
  }
  return zbir;
}

/**
 * Укупан дуг ученика.
 * Литература се наплаћује одвојено и НЕ улази у школарину.
 */
export function ukupanDug(cenaSkolarine: number | string | null | undefined): number {
  return Number(cenaSkolarine);
}

/** Пун износ провизије менаџера за једног ученика. */
export function provizijaMenadzera(
  cenaSkolarine: number | string | null | undefined,
  procenat: number | string | null | undefined
): number {
  if (!procenat) return 0;
  return Number(cenaSkolarine) * (Number(procenat) / 100);
}

/**
 * Колико менаџеру још следује.
 *
 * `neNegativno` постоји јер руте нису усаглашене: приликом исплате се
 * ограничава на нулу, а при приказу се не ограничава, па приказ може да
 * оде у минус кад се ученику накнадно обрише проценат.
 */
export function preostaloMenadzeru(
  provizija: number,
  isplaceno: number,
  neNegativno = false
): number {
  const razlika = provizija - isplaceno;
  return neNegativno ? Math.max(0, razlika) : razlika;
}

export interface StanjeUcenika {
  /** Сирово стање — може да буде и негативно (преплата). */
  stanje: number;
  /** Стање ограничено на нулу, како се приказује. */
  preostaliDug: number;
  /** Колико је уплаћено преко дуга. */
  preplata: number;
}

/**
 * Стање ученика: колико дугује школи.
 *
 *      дуг = школарина − уплаћено
 *
 * Исплата менаџеру НАМЕРНО не улази у овај рачун. Провизија је трошак
 * школе, не дуг ученика — ученик дугује исто без обзира да ли је и
 * колико менаџеру исплаћено. Колико менаџеру следује рачуна се
 * одвојено, функцијом `preostaloMenadzeru`.
 *
 * Раније су постојале две формуле које су обе увлачиле исплату менаџеру
 * у дуг ученика, свака са супротним знаком: списак ученика је умањивао
 * дуг за исплату, а екран уплата га је увећавао. Због тога је исти
 * ученик имао два различита дуга, а екран уплата је дозвољавао да се
 * упише тачно толико више колико је менаџеру исплаћено.
 */
export function stanjeUcenika(dug: number, uplaceno: number): StanjeUcenika {
  const stanje = dug - uplaceno;

  return {
    stanje,
    preostaliDug: Math.max(0, stanje),
    preplata: stanje < 0 ? Math.abs(stanje) : 0,
  };
}

/** Заокругљивање на две децимале, онако како руте враћају износе. */
export function zaokruziNovac(iznos: number): number {
  return parseFloat(iznos.toFixed(2));
}

/**
 * Највећи износ на који сме да се измени постојећа рата: онолико
 * колико остаје до дуга кад се одбију остале рате.
 *
 * Може да испадне негативан ако је ученик већ преплатио кроз остале
 * рате — тада ниједан позитиван износ није дозвољен.
 */
export function maksimalnaIzmenaUplate(
  dug: number,
  ostaleUplate: number
): number {
  return dug - ostaleUplate;
}

/** Улаз за пун обрачун једног ученика. */
export interface UcenikZaObracun {
  cenaSkolarine?: number | string | null;
  procenatManagera?: number | string | null;
  payments?: NovcanaStavka[] | null;
  managerPayouts?: NovcanaStavka[] | null;
}

export interface ObracunUcenika {
  ukupanDug: number;
  uplaceno: number;
  isplacenoMenadzeru: number;
  preostaliDug: number;
  preplata: number;
  provizijaMenadzera: number;
  preostaloMenadzeru: number;
}

/**
 * Пун обрачун за једног ученика.
 *
 * `neNegativnoZaMenadzera` се пушта на true само тамо где се проверава
 * колико сме да се исплати менаџеру.
 */
export function obracunUcenika(
  ucenik: UcenikZaObracun,
  neNegativnoZaMenadzera = false
): ObracunUcenika {
  const dug = ukupanDug(ucenik?.cenaSkolarine);
  const uplaceno = saberiIznose(ucenik?.payments, "уплате ученика");
  const isplaceno = saberiIznose(ucenik?.managerPayouts, "исплате менаџеру");

  const provizija = provizijaMenadzera(
    ucenik?.cenaSkolarine,
    ucenik?.procenatManagera
  );

  const { preostaliDug, preplata } = stanjeUcenika(dug, uplaceno);

  return {
    ukupanDug: dug,
    uplaceno,
    isplacenoMenadzeru: isplaceno,
    preostaliDug,
    preplata,
    provizijaMenadzera: provizija,
    preostaloMenadzeru: preostaloMenadzeru(
      provizija,
      isplaceno,
      neNegativnoZaMenadzera
    ),
  };
}
