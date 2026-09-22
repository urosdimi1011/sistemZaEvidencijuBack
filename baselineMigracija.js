/**
 * Baseline: upisuje 7 starih migracija u tabelu "migrations" kao već
 * izvršene, da bi "migration:run" pustio samo 6 novih.
 *
 * Potrebno jer je šema na produkciji nastala preko synchronize:true,
 * pa TypeORM nema evidenciju o njima i pokušao bi da ih izvrši ispočetka.
 *
 * Bez zastavice --potvrdi samo PROVERAVA i ništa ne menja:
 *     node baselineMigracija.js
 *
 * Sa zastavicom upisuje redove (u transakciji):
 *     node baselineMigracija.js --potvrdi
 */
const { Client } = require("pg");

const STARE_MIGRACIJE = [
  [1756301846074, "DodavanjeNovihTabelaIKolona1756301846074"],
  [1756301970413, "DodavanjeIzmena1756301970413"],
  [1756305409311, "DodavanjeIzmenaZaBrisanje1756305409311"],
  [1756307847242, "DodavanjeIzmenaZa1756307847242"],
  [1756902144706, "IzmenaTabeleStudent1756902144706"],
  [1756904120165, "Novo1756904120165"],
  [1757004100260, "IzmenaNekaNovo1757004100260"],
];

// Šema koju 7 starih migracija ostavlja za sobom — mora već da postoji
const MORA_DA_POSTOJI = [
  ["school", "id"],
  ["occupation", "schoolId"],
  ["student", "imeRoditelja"],
  ["student", "createdAt"],
  ["student", "occupationId"],
  ["student", "procenatManagera"],
  ["student", "managerId"],
  ["user", "schoolId"],
];

// Kolone koje tek nove migracije dodaju — NE smeju da postoje
const NE_SME_DA_POSTOJI = [
  ["menadzer", "procenat"],
  ["student", "literaturePaidAt"],
  ["student", "noteHandledAt"],
  ["user", "tipUpisa"],
  ["occupation", "zaRedovne"],
];

const potvrdjeno = process.argv.includes("--potvrdi");

const klijent = new Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
});

async function imaKolonu(tabela, kolona) {
  const r = await klijent.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name=$1 AND column_name=$2`,
    [tabela, kolona]
  );
  return r.rowCount > 0;
}

async function main() {
  await klijent.connect();
  console.log(`\nBaza: ${process.env.DB_NAME} na ${process.env.DB_HOST}\n`);

  let problema = 0;

  console.log("=== 1. Tabela migrations mora biti prazna ===");
  const post = await klijent.query(
    `SELECT COUNT(*)::int AS n FROM information_schema.tables
     WHERE table_schema='public' AND table_name='migrations'`
  );
  if (post.rows[0].n === 0) {
    console.log("  PROBLEM: tabela 'migrations' ne postoji");
    problema++;
  } else {
    const br = await klijent.query(`SELECT COUNT(*)::int AS n FROM migrations`);
    if (br.rows[0].n === 0) {
      console.log("  OK   prazna je");
    } else {
      console.log(`  PROBLEM: ima ${br.rows[0].n} redova — baseline je verovatno već urađen`);
      problema++;
    }
  }

  console.log("\n=== 2. Šema starih migracija mora već da postoji ===");
  for (const [t, k] of MORA_DA_POSTOJI) {
    const ima = await imaKolonu(t, k);
    console.log(`  ${ima ? "OK  " : "PROBLEM"} ${t}.${k}${ima ? "" : " — NEDOSTAJE"}`);
    if (!ima) problema++;
  }

  console.log("\n=== 3. Kolone novih migracija ne smeju da postoje ===");
  for (const [t, k] of NE_SME_DA_POSTOJI) {
    const ima = await imaKolonu(t, k);
    console.log(`  ${ima ? "PROBLEM" : "OK  "} ${t}.${k}${ima ? " — VEĆ POSTOJI" : ""}`);
    if (ima) problema++;
  }

  if (problema > 0) {
    console.log(`\nSTOP: ${problema} problema. Ne upisujem ništa.\n`);
    await klijent.end();
    process.exit(1);
  }

  console.log("\nSve provere prošle.");

  if (!potvrdjeno) {
    console.log(
      "\nOvo je bila samo provera — ništa nije upisano.\n" +
        "Kad napraviš rezervnu kopiju, pokreni:\n" +
        "    node baselineMigracija.js --potvrdi\n"
    );
    await klijent.end();
    return;
  }

  console.log("\n=== UPISUJEM BASELINE ===");
  await klijent.query("BEGIN");
  try {
    for (const [vreme, naziv] of STARE_MIGRACIJE) {
      await klijent.query(
        `INSERT INTO migrations ("timestamp", "name") VALUES ($1, $2)`,
        [vreme, naziv]
      );
      console.log("  upisano:", naziv);
    }
    await klijent.query("COMMIT");
    console.log("\nGotovo. Sada pokreni: npm run migration:show\n");
  } catch (e) {
    await klijent.query("ROLLBACK");
    console.error("\nGREŠKA, ništa nije upisano:", e.message, "\n");
    process.exit(1);
  } finally {
    await klijent.end();
  }
}

main().catch((e) => {
  console.error("\nGREŠKA:", e.message, "\n");
  process.exit(1);
});
