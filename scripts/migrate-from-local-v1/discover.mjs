// =====================================================================
// Mode "discover" : inspecte la base locale et affiche :
//  - la liste de toutes les tables du schéma public
//  - le nombre de lignes par table
//  - les colonnes (nom, type, nullable) par table
//  - un échantillon de 1 ligne par table (sans valeurs sensibles)
//
// Lance : node discover.mjs
// =====================================================================
import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;

const localUrl = process.env.LOCAL_DB_URL;
if (!localUrl) {
  console.error('❌ LOCAL_DB_URL manquante dans .env');
  process.exit(1);
}

const client = new Client({ connectionString: localUrl });
await client.connect();

try {
  // 1) Liste des tables
  const tables = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);

  console.log('\n===== TABLES =====');
  for (const t of tables.rows) {
    const countRes = await client.query(`SELECT COUNT(*)::int AS n FROM public."${t.table_name}"`);
    console.log(`  ${t.table_name.padEnd(30)} ${countRes.rows[0].n} lignes`);
  }

  console.log('\n===== STRUCTURE + ÉCHANTILLON =====');
  for (const t of tables.rows) {
    const name = t.table_name;
    const cols = await client.query(
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
       ORDER BY ordinal_position`,
      [name],
    );
    console.log(`\n── ${name} (${cols.rows.length} colonnes) ──`);
    for (const c of cols.rows) {
      console.log(`    ${c.column_name.padEnd(28)} ${c.data_type.padEnd(28)} ${c.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
    }
    try {
      const sample = await client.query(`SELECT * FROM public."${name}" LIMIT 1`);
      if (sample.rows.length > 0) {
        console.log('    Échantillon :');
        const obfuscated = { ...sample.rows[0] };
        // masque les valeurs longues / sensibles pour le log
        for (const k of Object.keys(obfuscated)) {
          const v = obfuscated[k];
          if (typeof v === 'string' && v.length > 60) obfuscated[k] = v.slice(0, 60) + '…';
          if (k.toLowerCase().includes('password')) obfuscated[k] = '***';
        }
        console.log(JSON.stringify(obfuscated, null, 6));
      }
    } catch (e) {
      console.log(`    (échec échantillon : ${e.message})`);
    }
  }
} finally {
  await client.end();
}

console.log('\n✓ Done.');
