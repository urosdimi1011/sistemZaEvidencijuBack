/**
 * Pregled zatečenih isplata menadžerima, pred prelazak na rate.
 * Pokreće se sa: node proveraIsplata.js
 *
 * Menadžer sada zarađuje svoj procenat od svake uplate učenika, pa se
 * isplate vode kao "rate" — po jedna uz svaku uplatu, sa štiklicom.
 *
 * Isplate unete ranije nemaju vezu za konkretnu uplatu. Ovaj ispis
 * pokazuje koliko ih ima i da li bi se uopšte mogle povezati, da bi se
 * odluka donela na osnovu brojeva a ne pretpostavke.
 *
 * SAMO ČITA — ništa ne menja.
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

const novac = (x) => Number(x || 0).toFixed(2);

async function main() {
  await klijent.connect();
  console.log(`\nБаза: ${process.env.DB_NAME} на ${process.env.DB_HOST}\n`);

  const { rows: isplate } = await klijent.query(`
    SELECT mp."id", mp."amount", mp."studentId", mp."paidAt",
           s."procenatManagera", s."ime", s."prezime"
    FROM "manager_payment" mp
    JOIN "student" s ON s."id" = mp."studentId"
    ORDER BY mp."studentId", mp."id"
  `);

  const { rows: uplate } = await klijent.query(`
    SELECT "id", "studentId", "amount" FROM "payment" ORDER BY "studentId", "id"
  `);

  const uplatePoUceniku = new Map();
  for (const u of uplate) {
    if (!uplatePoUceniku.has(u.studentId)) uplatePoUceniku.set(u.studentId, []);
    uplatePoUceniku.get(u.studentId).push({
      id: u.id,
      iznos: Number(u.amount),
      uzeta: false,
    });
  }

  let poklapa = 0;
  let nePoklapa = 0;
  let bezUplata = 0;
  let ukupanIznos = 0;
  const ucenici = new Set();
  const primeri = [];

  for (const i of isplate) {
    const iznos = Number(i.amount);
    ukupanIznos += iznos;
    ucenici.add(i.studentId);

    const sve = uplatePoUceniku.get(i.studentId) ?? [];
    if (sve.length === 0) {
      bezUplata++;
      continue;
    }

    const procenat = Number(i.procenatManagera) || 0;
    const nadjena = sve.find(
      (u) => !u.uzeta && Math.abs(u.iznos * (procenat / 100) - iznos) < 0.005
    );

    if (nadjena) {
      nadjena.uzeta = true;
      poklapa++;
    } else {
      nePoklapa++;
      if (primeri.length < 8) {
        primeri.push(
          `   #${i.studentId} ${i.ime} ${i.prezime} — исплата ${novac(
            iznos
          )} €, проценат ${procenat}%, уплате: ${sve
            .map((u) => novac(u.iznos))
            .join(", ")}`
        );
      }
    }
  }

  console.log("=== ЗАТЕЧЕНЕ ИСПЛАТЕ МЕНАЏЕРИМА ===");
  console.log(`  записа:          ${isplate.length}`);
  console.log(`  ученика:         ${ucenici.size}`);
  console.log(`  укупан износ:    ${novac(ukupanIznos)} €\n`);

  console.log("=== ДА ЛИ БИ СЕ МОГЛЕ ПОВЕЗАТИ СА УПЛАТАМА ===");
  console.log(`  поклапа се тачно са једном ратом:  ${poklapa}`);
  console.log(`  не поклапа се ни са једном:        ${nePoklapa}`);
  console.log(`  ученик нема ниједну уплату:        ${bezUplata}`);

  const procenatPoklapanja = isplate.length
    ? Math.round((poklapa / isplate.length) * 100)
    : 0;
  console.log(`\n  поклапање: ${procenatPoklapanja}%`);

  if (primeri.length > 0) {
    console.log("\n=== ПРИМЕРИ КОЈИ СЕ НЕ ПОКЛАПАЈУ ===");
    primeri.forEach((p) => console.log(p));
  }

  console.log(
    `\nПрепорука: испод 90% поклапања не вреди спаривати аутоматски —\n` +
      `боље затечене исплате приказати засебно и пустити админа да одлучи.\n`
  );

  await klijent.end();
}

main().catch((e) => {
  console.error("\nГРЕШКА:", e.message, "\n");
  process.exit(1);
});
