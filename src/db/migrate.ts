import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool, checkDbHealth } from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations(): Promise<void> {
  console.log('🔄 Checking database connection before running migrations...');
  const health = await checkDbHealth();
  if (health.status !== 'connected') {
    throw new Error(`Database connection failed: ${health.error}`);
  }

  console.log('📦 Reading schema SQL file...');
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

  console.log('🚀 Executing database migrations...');
  await pool.query(schemaSql);
  console.log('✅ Database schema migrations executed successfully.');
}

// Allow direct execution via CLI
if (process.argv[1] === __filename) {
  runMigrations()
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('❌ Migration failed:', err);
      await pool.end();
      process.exit(1);
    });
}
