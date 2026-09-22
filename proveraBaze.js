/**
 * Privremena provera stanja baze. SAMO ČITA — ništa ne menja.
 * Pokreće se sa: node proveraBaze.js
 * Koristi iste promenljive okruženja kao migracije.
 */
const { Client } = require("pg");

const klijent = new Client({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false,
});

async function main() {
  await klijent.connect();

  console.log("\n=== NA ŠTA SAM POVEZAN ===");
  console.log("  host :", process.env.DB_HOST);
  console.log("  baza :", process.env.DB_NAME);
  console.log("  user :", process.env.DB_USERNAME);

  const tabele = await klijent.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' ORDER BY table_name`
  );

  console.log(`\n=== TABELE U BAZI: ${tabele.rows.length} ===`);
  tabele.rows.forEach((r) => console.log("  -", r.table_name));

  const imenaTabela = tabele.rows.map((r) => r.table_name);

  console.log("\n=== TABELA 'migrations' ===");
  if (!imenaTabela.includes("migrations")) {
    console.log("  NE POSTOJI — šema nije pravljena migracijama.");
  } else {
    const m = await klijent.query(
      `SELECT id, name FROM migrations ORDER BY id`
    );
    console.log(`  postoji, upisanih redova: ${m.rows.length}`);
    m.rows.forEach((r) => console.log(`    ${r.id}  ${r.name}`));
  }

  console.log("\n=== KOLIKO IMA PODATAKA ===");
  for (const t of ["student", "payment", "manager_payment", "user", "menadzer", "school", "occupation"]) {
    if (!imenaTabela.includes(t)) {
      console.log(`  ${t.padEnd(16)} tabela ne postoji`);
      continue;
    }
    const c = await klijent.query(`SELECT COUNT(*)::int AS n FROM "${t}"`);
    console.log(`  ${t.padEnd(16)} ${c.rows[0].n} redova`);
  }

  // Kolone koje dodaju nove migracije — ako već postoje, šema je ispred evidencije
  console.log("\n=== DA LI NOVE KOLONE VEĆ POSTOJE ===");
  const provere = [
    ["menadzer", "procenat"],
    ["student", "literaturePaidAt"],
    ["student", "noteHandledAt"],
    ["student", "type"],
    ["user", "tipUpisa"],
    ["occupation", "zaRedovne"],
  ];
  for (const [tabela, kolona] of provere) {
    if (!imenaTabela.includes(tabela)) {
      console.log(`  ${tabela}.${kolona.padEnd(18)} tabela ne postoji`);
      continue;
    }
    const k = await klijent.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name=$1 AND column_name=$2`,
      [tabela, kolona]
    );
    console.log(
      `  ${tabela}.${kolona.padEnd(18)} ${k.rowCount ? "VEĆ POSTOJI" : "nema je"}`
    );
  }

  // Da li su migracije 11 i 13 zaista pogodile prave redove
  if (imenaTabela.includes("occupation")) {
    console.log("\n=== ZANIMANJA ZA REDOVNE UČENIKE ===");
    const r = await klijent.query(
      `SELECT s."name" AS skola, COUNT(*)::int AS n
       FROM "occupation" o JOIN "school" s ON s."id" = o."schoolId"
       WHERE o."zaRedovne" = true GROUP BY s."name" ORDER BY s."name"`
    );
    if (r.rows.length === 0) {
      console.log("  PROBLEM: nijedno zanimanje nije označeno za redovne");
      console.log("  -> nalozi za redovne neće imati šta da izaberu");
    } else {
      r.rows.forEach((x) => console.log(`  ${x.n}  ${x.skola}`));
    }

    console.log("\n=== NAZIVI ŠKOLA ===");
    const sk = await klijent.query(`SELECT "name" FROM "school" ORDER BY "name"`);
    sk.rows.forEach((x) => console.log("  -", x.name));

    console.log("\n=== NALOZI PO VRSTI UPISA ===");
    const u = await klijent.query(
      `SELECT "role", COALESCE("tipUpisa", '(nije vezan)') AS tip, COUNT(*)::int AS n
       FROM "user" GROUP BY "role", "tipUpisa" ORDER BY "role"`
    );
    u.rows.forEach((x) => console.log(`  ${String(x.n).padStart(3)}  ${x.role} / ${x.tip}`));

    console.log("\n=== UČENICI PO VRSTI ===");
    const st = await klijent.query(
      `SELECT COALESCE("type", '(bez tipa)') AS tip, COUNT(*)::int AS n
       FROM "student" GROUP BY "type" ORDER BY 2 DESC`
    );
    st.rows.forEach((x) => console.log(`  ${String(x.n).padStart(4)}  ${x.tip}`));
  }

  await klijent.end();
  console.log("");
}

main().catch((e) => {
  console.error("\nGREŠKA:", e.message);
  process.exit(1);
});
