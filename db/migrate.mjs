// One-shot migration runner.
// Usage: DATABASE_URL=... node db/migrate.mjs
import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set. Run with: DATABASE_URL=... node db/migrate.mjs');
  process.exit(1);
}

const sql = neon(url);
const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');

const statements = schema
  .split(/;\s*\n/)
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'));

console.log(`Running ${statements.length} statements against Neon...`);

for (const stmt of statements) {
  try {
    await sql.query(stmt);
    const preview = stmt.split('\n')[0].slice(0, 80);
    console.log(`  ok  ${preview}${preview.length === 80 ? '...' : ''}`);
  } catch (err) {
    console.error(`  fail  ${stmt.slice(0, 80)}`);
    console.error(err.message);
    process.exit(1);
  }
}

console.log('Migration complete.');
