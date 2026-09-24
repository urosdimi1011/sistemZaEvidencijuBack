/**
 * Provera ko sme šta sa uplatama.
 * Pokreće se sa: npm run test:pristup
 *
 * Ovo je jedino što sprečava da nalog jedne škole unese uplatu učeniku
 * druge škole — URL nosi samo ID učenika, ne i školu.
 */
import {
  zabranaPristupaUceniku,
  samoAdminIliRacunovodja,
  KorisnikZahteva,
} from "../utiles/pristupUplatama";

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

function sme(opis: string, user: any, ucenik: any) {
  const r = zabranaPristupaUceniku(user, ucenik);
  proveri(opis, r === null, `-> одбијено: ${r}`);
}

function neSme(opis: string, user: any, ucenik: any) {
  const r = zabranaPristupaUceniku(user, ucenik);
  proveri(opis, r !== null, "-> пропуштено, а није смело");
}

/** Ученик из школе са датим ID-јем. */
function ucenik(schoolId: number | null, type: string | null = "redovni") {
  return {
    type,
    occupation: schoolId === null ? null : { school: { id: schoolId } },
  };
}

const admin: KorisnikZahteva = { role: "admin", schoolId: null, tipUpisa: null };
const racunovodja: KorisnikZahteva = { role: "racunovodja", schoolId: null, tipUpisa: null };
const ssdRedovni: KorisnikZahteva = { role: "school_manager", schoolId: 1, tipUpisa: "redovni" };
const ssdVanredni: KorisnikZahteva = { role: "school_manager", schoolId: 1, tipUpisa: "vandredni" };
const smsRedovni: KorisnikZahteva = { role: "school_manager", schoolId: 2, tipUpisa: "redovni" };

function main() {
  console.log("\n=== 1. Администратор и рачуновођа ===");
  sme("админ сме свуда", admin, ucenik(1));
  sme("админ сме и у другој школи", admin, ucenik(99, "vandredni"));
  sme("рачуновођа сме свуда", racunovodja, ucenik(5, "vandredni"));

  console.log("\n=== 2. Налог за редовне ради само своју школу ===");
  sme("свој ученик, своја врста уписа", ssdRedovni, ucenik(1, "redovni"));
  neSme("ученик друге школе", ssdRedovni, ucenik(2, "redovni"));
  neSme("ванредни ученик у својој школи", ssdRedovni, ucenik(1, "vandredni"));
  neSme("ученик без школе", ssdRedovni, ucenik(null));

  console.log("\n=== 3. Налог за ванредне ===");
  sme("свој ванредни ученик", ssdVanredni, ucenik(1, "vandredni"));
  neSme("редовни ученик исте школе", ssdVanredni, ucenik(1, "redovni"));

  console.log("\n=== 4. Две школе се не мешају ===");
  neSme("медицинска не сме у Доситеј", smsRedovni, ucenik(1, "redovni"));
  sme("медицинска сме своје", smsRedovni, ucenik(2, "redovni"));

  console.log("\n=== 5. Гранични случајеви ===");
  neSme("нема корисника (без токена)", null, ucenik(1));
  neSme("непозната улога", { role: "нешто", schoolId: 1 }, ucenik(1));
  neSme("ученик не постоји", ssdRedovni, null);
  neSme(
    "налог школе без додељене школе",
    { role: "school_manager", schoolId: null, tipUpisa: "redovni" },
    ucenik(1, "redovni")
  );
  neSme("ученик без врсте уписа", ssdRedovni, ucenik(1, null));

  // schoolId 0 ne sme da se protumači kao "poklapa se"
  neSme(
    "школа са ID 0 се не пропушта",
    { role: "school_manager", schoolId: 0, tipUpisa: "redovni" },
    ucenik(0, "redovni")
  );

  console.log("\n=== 6. Измена, брисање и исплате менаџерима ===");
  proveri("админ сме", samoAdminIliRacunovodja(admin) === null);
  proveri("рачуновођа сме", samoAdminIliRacunovodja(racunovodja) === null);
  proveri(
    "налог за редовне НЕ сме",
    samoAdminIliRacunovodja(ssdRedovni) !== null
  );
  proveri(
    "налог за ванредне НЕ сме",
    samoAdminIliRacunovodja(ssdVanredni) !== null
  );
  proveri("без корисника НЕ сме", samoAdminIliRacunovodja(null) !== null);

  console.log(
    greske === 0
      ? `\nРЕЗУЛТАТ: свих ${provera} провера прошло\n`
      : `\nРЕЗУЛТАТ: ${greske} од ${provera} провера НИЈЕ прошло\n`
  );

  process.exit(greske === 0 ? 0 : 1);
}

main();
