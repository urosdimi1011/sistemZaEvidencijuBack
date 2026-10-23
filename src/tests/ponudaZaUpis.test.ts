/**
 * Провера шта се нуди при упису ученика.
 * Покреће се са: npm run test:ponuda
 *
 * Правило: угашен смер или школа се НЕ НУДЕ при упису новог ученика,
 * али се и даље виде свуда где већ постоје ученици.
 *
 * Најважнија провера је она о измени затеченог ученика — да му се
 * угашени смер и даље понуди, иначе му се поље испразни.
 */
import { ponudaZaUpis, nazivSaOznakom } from "../utiles/ponudaZaUpis";

let greske = 0;
let provera = 0;

function proveri(opis: string, uslov: boolean, detalj = "") {
  provera++;
  if (uslov) console.log(`  OK   ${opis}`);
  else { greske++; console.log(`  ПАД  ${opis} ${detalj}`); }
}

function jednako(opis: string, dobijeno: any, ocekivano: any) {
  proveri(opis, Object.is(dobijeno, ocekivano), `-> ${dobijeno} уместо ${ocekivano}`);
}

const smerovi = [
  { id: 1, name: "Економски техничар", aktivan: true },
  { id: 2, name: "Техничар дизајна текстила", aktivan: false },
  { id: 3, name: "Општа гимназија", aktivan: true },
];

function main() {
  console.log("\n=== 1. Нови упис — угашено се не нуди ===");

  const nov = ponudaZaUpis(smerovi);
  jednako("нуде се два смера, не три", nov.length, 2);
  proveri("угашени није у понуди", !nov.some((s) => s.id === 2));
  proveri("активни јесу", nov.some((s) => s.id === 1) && nov.some((s) => s.id === 3));

  console.log("\n=== 2. Измена ученика — његов смер остаје ===");

  // Ученик је уписан на смер 2, који је у међувремену угашен
  const izmena = ponudaZaUpis(smerovi, 2);
  jednako("нуде се сва три", izmena.length, 3);
  proveri(
    "његов угашени смер је у понуди",
    izmena.some((s) => s.id === 2)
  );

  // Ако ученик има активан смер, ништа се не мења
  const izmenaAktivan = ponudaZaUpis(smerovi, 1);
  jednako("ученик на активном смеру — и даље два", izmenaAktivan.length, 2);

  console.log("\n=== 3. Ознака у називу ===");

  jednako(
    "активан смер нема ознаку",
    nazivSaOznakom(smerovi[0]),
    "Економски техничар"
  );
  jednako(
    "угашен смер је означен",
    nazivSaOznakom(smerovi[1]),
    "Техничар дизајна текстила (угашен)"
  );
  jednako(
    "ознака се може променити за школе",
    nazivSaOznakom({ id: 9, name: "Школа", aktivan: false }, "угашена"),
    "Школа (угашена)"
  );

  console.log("\n=== 4. Гранични унос ===");

  jednako("празан списак", ponudaZaUpis([]).length, 0);
  jednako("списак није учитан", ponudaZaUpis(null).length, 0);
  jednako("списак недостаје", ponudaZaUpis(undefined).length, 0);

  // Затечени подаци немају то поље — не смеју да нестану
  const bezPolja = [{ id: 1, name: "Стари смер" }];
  jednako(
    "ставка без поља се сматра активном",
    ponudaZaUpis(bezPolja).length,
    1
  );

  jednako("zadrzi = null се игнорише", ponudaZaUpis(smerovi, null).length, 2);
  jednako("zadrzi = NaN се игнорише", ponudaZaUpis(smerovi, NaN).length, 2);
  jednako(
    "zadrzi за непостојећи смер ништа не мења",
    ponudaZaUpis(smerovi, 999).length,
    2
  );

  console.log(
    greske === 0
      ? `\nРЕЗУЛТАТ: свих ${provera} провера прошло\n`
      : `\nРЕЗУЛТАТ: ${greske} од ${provera} провера НИЈЕ прошло\n`
  );
  process.exit(greske === 0 ? 0 : 1);
}

main();
