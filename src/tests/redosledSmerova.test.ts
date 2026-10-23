/**
 * Провера редоследа смерова.
 * Покреће се са: npm run test:redosled
 *
 * Школе имају свој уобичајени поредак који није азбучни. Код медицинске
 * прво иде медицинска сестра техничар, па зубни, па физиотерапеутски, и
 * тек онда остали.
 *
 * Правило: прво смерови са одређеним редоследом (мањи број напред), па
 * они без редоследа — азбучно. Тиме затечени смерови, који сви имају
 * нулу, остају поређани као и до сада.
 */
import {
  uporediSmerove,
  poredjaniSmerovi,
  redosledIzSpiska,
} from "../utiles/redosledSmerova";

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

const imena = (niz: any[]) => niz.map((s) => s.name).join(", ");

function main() {
  console.log("\n=== 1. Пример клијента — медицинска школа ===");

  const medicinska = [
    { name: "Фармацеутски техничар", redosled: 0 },
    { name: "Зубни техничар", redosled: 2 },
    { name: "Лабораторијски техничар", redosled: 0 },
    { name: "Медицинска сестра техничар", redosled: 1 },
    { name: "Физиотерапеутски техничар", redosled: 3 },
    { name: "Стоматолошка сестра", redosled: 0 },
  ];

  const p = poredjaniSmerovi(medicinska);
  jednako("прва је медицинска сестра техничар", p[0].name, "Медицинска сестра техничар");
  jednako("друга је зубни техничар", p[1].name, "Зубни техничар");
  jednako("трећа је физиотерапеутски техничар", p[2].name, "Физиотерапеутски техничар");
  proveri(
    "остали иду после, азбучно",
    imena(p.slice(3)) ===
      "Лабораторијски техничар, Стоматолошка сестра, Фармацеутски техничар",
    `-> ${imena(p.slice(3))}`
  );

  console.log("\n=== 2. Затечено стање — све нуле ===");

  const zateceno = [
    { name: "Општа гимназија", redosled: 0 },
    { name: "Економски техничар", redosled: 0 },
    { name: "Правно-пословни техничар", redosled: 0 },
  ];
  jednako(
    "без одређеног редоследа остаје азбучно",
    imena(poredjaniSmerovi(zateceno)),
    "Економски техничар, Општа гимназија, Правно-пословни техничар"
  );

  console.log("\n=== 3. Понашање функције за поређење ===");

  proveri("мањи број иде напред", uporediSmerove({ name: "Б", redosled: 1 }, { name: "А", redosled: 2 }) < 0);
  proveri("одређен иде пре неодређеног", uporediSmerove({ name: "Б", redosled: 5 }, { name: "А", redosled: 0 }) < 0);
  proveri("неодређен иде после одређеног", uporediSmerove({ name: "А", redosled: 0 }, { name: "Б", redosled: 9 }) > 0);
  proveri("два неодређена по називу", uporediSmerove({ name: "А", redosled: 0 }, { name: "Б", redosled: 0 }) < 0);

  console.log("\n=== 4. Гранични унос ===");

  jednako("празан списак", poredjaniSmerovi([]).length, 0);
  jednako("списак није учитан", poredjaniSmerovi(null).length, 0);
  proveri(
    "недостајуће поље се сматра нулом",
    poredjaniSmerovi([{ name: "Б" }, { name: "А" }])[0].name === "А"
  );
  proveri(
    "улазни низ се не мења",
    (() => {
      const ulaz = [{ name: "Б", redosled: 0 }, { name: "А", redosled: 0 }];
      poredjaniSmerovi(ulaz);
      return ulaz[0].name === "Б";
    })()
  );

  console.log("\n=== 5. Претварање списка у редослед ===");

  const mapa = redosledIzSpiska([7, 3, 9]);
  jednako("први добија 1", mapa!.get(7), 1);
  jednako("други добија 2", mapa!.get(3), 2);
  jednako("трећи добија 3", mapa!.get(9), 3);

  proveri("исти смер двапут се одбија", redosledIzSpiska([5, 5]) === null);
  proveri("нечитљив id се одбија", redosledIzSpiska([1, "abc"]) === null);
  proveri("нула као id се одбија", redosledIzSpiska([0, 1]) === null);
  proveri("негативан id се одбија", redosledIzSpiska([-2]) === null);
  proveri("празан списак се одбија", redosledIzSpiska([]) === null);
  proveri("није низ", redosledIzSpiska("1,2") === null);

  console.log(
    greske === 0
      ? `\nРЕЗУЛТАТ: свих ${provera} провера прошло\n`
      : `\nРЕЗУЛТАТ: ${greske} од ${provera} провера НИЈЕ прошло\n`
  );
  process.exit(greske === 0 ? 0 : 1);
}

main();
