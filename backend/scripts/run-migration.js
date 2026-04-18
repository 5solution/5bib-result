// Minimal volunteer-DB migration runner.
// Usage:  node scripts/run-migration.js <path-to.sql>
// Reads VOLUNTEER_DB_* env from backend/.env, splits SQL on `;` at EOL,
// runs each statement sequentially. Fails fast on error.
//
// Not idempotent — caller is responsible for tracking which migrations ran.

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

function loadEnv() {
  const envPath = path.resolve(__dirname, '..', '.env');
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  const env = {};
  for (const l of lines) {
    const m = l.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

function splitStatements(sql) {
  // Strip `-- ...` comments (line-level), then split on `;` at EOL.
  const noComments = sql
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n');
  return noComments
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node scripts/run-migration.js <path-to.sql>');
    process.exit(1);
  }
  const fullPath = path.resolve(file);
  const sql = fs.readFileSync(fullPath, 'utf8');
  const statements = splitStatements(sql);
  const env = loadEnv();

  const conn = await mysql.createConnection({
    host: env.VOLUNTEER_DB_HOST,
    port: Number(env.VOLUNTEER_DB_PORT),
    user: env.VOLUNTEER_DB_USER,
    password: env.VOLUNTEER_DB_PASS,
    database: env.VOLUNTEER_DB_NAME,
    multipleStatements: false,
  });

  console.log(`[migration] ${path.basename(fullPath)}: ${statements.length} statements`);
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.substring(0, 80).replace(/\s+/g, ' ');
    process.stdout.write(`  [${i + 1}/${statements.length}] ${preview}... `);
    try {
      await conn.query(stmt);
      console.log('OK');
    } catch (err) {
      console.log('FAIL');
      console.error(err.message);
      await conn.end();
      process.exit(1);
    }
  }
  await conn.end();
  console.log('[migration] done');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
