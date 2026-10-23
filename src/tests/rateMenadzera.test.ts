/**
 * Провера рата менаџера — колико му следи од сваке уплате ученика.
 * Покреће се са: npm run test:rate
 *
 * Правило које се брани:
 *
 *     од сваке уплате менаџеру следи његов проценат,
 *     а збир свих рата мора да буде тачно проценат од школарине
 *
 * Други део је оно што клијент проверава ручно, па мора да се поклопи
 * до цента и на ратама које се не деле лепо.
 */
import {
  rataOdUplate,
  rateZaUcenika,
  zbirRata,
} from "../utiles/rateMenadzera";

let greske = 0;
let provera = 0;

function proveri(opis: string, uslov: boolean, detalj = "") {
  provera++;
  if (uslov) {
    console.log(`  OK   ${opis}`);
  } else {
    greske++;
    console.log(`  ПАД  ${opis} ${detalj}`);
  }
}

function jednako(opis: string, dobijeno: any, ocekivano: any) {
  proveri(
    opis,
    Object.is(dobijeno, ocekivano),
    `-> добијено ${dobijeno}, очекивано ${ocekivano}`
  );
}

/** Уплата ученика. */
function u(id: number, amount: any, dan: string) {
  return { id, amount, paidAt: new Date(dan) };
}

/** Исплата менаџеру везана за уплату. */
function i(id: number, amount: any, paymentId: number | null, dan: string) {
  return { id, amount, paymentId, paidAt: new Date(dan) };
}

function main() {
  console.log("\n=== 1. Пример из захтева: 1500 и 20% ===");

  jednako("од уплате 500 следи 100", rataOdUplate(500, 20), 100);
  jednako("од уплате 1000 следи 200", rataOdUplate(1000, 20), 200);
  jednako("укупно 300, као 20% од 1500", 100 + 200, 1500 * 0.2);

  const rate = rateZaUcenika(
    [u(1, "500.00", "2026-09-15"), u(2, "1000.00", "2026-11-20")],
    [],
    20
  );

  jednako("две уплате — две рате", rate.length, 2);
  jednako("најновија рата је прва", rate[0].paymentId, 2);
  jednako("новембарска рата је 200", rate[0].sledujeMenadzeru, 200);
  jednako("септембарска рата је 100", rate[1].sledujeMenadzeru, 100);

  const z = zbirRata(rate);
  jednako("зарађено укупно 300", z.zaradjeno, 300);
  jednako("ништа још није исплаћено", z.isplacenoKrozRate, 0);
  jednako("преостало по ратама 300", z.preostaloPoRatama, 300);

  console.log("\n=== 2. Штиклирање појединачне рате ===");

  const saIsplatom = rateZaUcenika(
    [u(1, "500.00", "2026-09-15"), u(2, "1000.00", "2026-11-20")],
    [i(10, "100.00", 1, "2026-09-20")],
    20
  );

  const septembar = saIsplatom.find((r) => r.paymentId === 1)!;
  const novembar = saIsplatom.find((r) => r.paymentId === 2)!;

  proveri("септембарска рата означена као исплаћена", septembar.isplaceno);
  proveri("новембарска још није", !novembar.isplaceno);
  jednako("памти се који је запис о исплати", septembar.isplataId, 10);
  jednako("памти се стварно исплаћен износ", septembar.isplaceniIznos, 100);

  const z2 = zbirRata(saIsplatom);
  jednako("зарађено и даље 300", z2.zaradjeno, 300);
  jednako("исплаћено 100", z2.isplacenoKrozRate, 100);
  jednako("преостало 200", z2.preostaloPoRatama, 200);
  jednako("једна од две рате је исплаћена", z2.brojIsplacenih, 1);

  console.log("\n=== 3. Редовни ученици — 10% ===");

  jednako("од уплате 1900 следи 190", rataOdUplate(1900, 10), 190);
  const redovni = rateZaUcenika([u(1, 1900, "2026-09-01")], [], 10);
  jednako("једна рата од 190", redovni[0].sledujeMenadzeru, 190);

  console.log("\n=== 4. Ученик без менаџера ===");

  jednako("проценат null даје 0", rataOdUplate(1000, null), 0);
  jednako("проценат 0 даје 0", rataOdUplate(1000, 0), 0);

  const bezMenadzera = rateZaUcenika([u(1, 1000, "2026-09-01")], [], null);
  jednako("рата постоји, али је нула", bezMenadzera[0].sledujeMenadzeru, 0);
  jednako("зарађено 0", zbirRata(bezMenadzera).zaradjeno, 0);

  console.log("\n=== 5. Децимале — збир мора да се поклопи ===");

  // 1000 подељено на три рате, 20% од сваке
  const tri = rateZaUcenika(
    [
      u(1, "333.33", "2026-09-01"),
      u(2, "333.33", "2026-10-01"),
      u(3, "333.34", "2026-11-01"),
    ],
    [],
    20
  );
  const zTri = zbirRata(tri);
  jednako("20% од 333.33 је 66.67", tri[2].sledujeMenadzeru, 66.67);
  jednako("20% од 333.34 је 66.67", tri[0].sledujeMenadzeru, 66.67);
  jednako("збир рата је 200.01", zTri.zaradjeno, 200.01);

  // Клијент ће ово сабрати ручно — зато мора да буде у центу
  proveri(
    "збир рата се од 20% укупне уплате разликује највише за цент",
    Math.abs(zTri.zaradjeno - 1000 * 0.2) <= 0.02,
    `-> ${zTri.zaradjeno} наспрам 200`
  );

  console.log("\n=== 6. Раније унете исплате (без везе за уплату) ===");

  const saStarom = rateZaUcenika(
    [u(1, "500.00", "2026-09-15")],
    [i(5, "300.00", null, "2026-05-01")],
    20
  );
  proveri(
    "стара исплата не штиклира ниједну рату",
    !saStarom[0].isplaceno
  );
  jednako(
    "зато што није везана за уплату",
    zbirRata(saStarom).isplacenoKrozRate,
    0
  );

  console.log("\n=== 7. Преплата не сме да надува провизију ===");

  // Школарина 1500, менаџер 20% -> следује му највише 300.
  // Ученик уплати 1800 — провизија остаје 300, не 360.
  const saPreplatom = rateZaUcenika(
    [
      u(1, 500, "2026-09-01"),
      u(2, 1000, "2026-10-01"),
      u(3, 300, "2026-11-01"),
    ],
    [],
    20,
    300
  );
  const zPre = zbirRata(saPreplatom);

  jednako("зарађено стаје на 300, не 360", zPre.zaradjeno, 300);
  jednako("прва уплата даје пуних 100", saPreplatom[2].sledujeMenadzeru, 100);
  jednako("друга уплата даје пуних 200", saPreplatom[1].sledujeMenadzeru, 200);
  jednako("уплата преко границе даје 0", saPreplatom[0].sledujeMenadzeru, 0);

  // Граница се троши хронолошки, па уплата која је пробија добија остатак
  const delimicno = rateZaUcenika(
    [u(1, 1000, "2026-09-01"), u(2, 1000, "2026-10-01")],
    [],
    20,
    300
  );
  jednako("прва уплата даје 200", delimicno[1].sledujeMenadzeru, 200);
  jednako("друга добија само остатак од 100", delimicno[0].sledujeMenadzeru, 100);
  jednako("укупно тачно 300", zbirRata(delimicno).zaradjeno, 300);

  // Без границе се понаша као и пре
  const bezGranice = rateZaUcenika([u(1, 1800, "2026-09-01")], [], 20);
  jednako("без задате границе нема ограничења", bezGranice[0].sledujeMenadzeru, 360);

  // Редослед: старија уплата троши границу прва, без обзира како стигну
  const obrnuto = rateZaUcenika(
    [u(2, 1000, "2026-10-01"), u(1, 1000, "2026-09-01")],
    [],
    20,
    300
  );
  jednako(
    "старија уплата добија пун износ иако је наведена друга",
    obrnuto.find((r) => r.paymentId === 1)!.sledujeMenadzeru,
    200
  );

  console.log("\n=== 8. Гранични унос ===");

  jednako("нема уплата — нема рата", rateZaUcenika([], [], 20).length, 0);
  jednako("уплате нису учитане", rateZaUcenika(null, [], 20).length, 0);
  jednako("нечитљив износ даје 0", rataOdUplate("сто", 20), 0);
  jednako("негативна уплата даје негативну рату", rataOdUplate(-500, 20), -100);

  const praznaIsplata = rateZaUcenika([u(1, 500, "2026-09-01")], null, 20);
  proveri("исплате нису учитане — рата није исплаћена", !praznaIsplata[0].isplaceno);

  console.log(
    greske === 0
      ? `\nРЕЗУЛТАТ: свих ${provera} провера прошло\n`
      : `\nРЕЗУЛТАТ: ${greske} од ${provera} провера НИЈЕ прошло\n`
  );

  process.exit(greske === 0 ? 0 : 1);
}

main();
