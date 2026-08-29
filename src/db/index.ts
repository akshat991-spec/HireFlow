import pg from 'pg';
import { config } from '../config.js';

const { Pool } = pg;

// Detect if SSL should be used (e.g. for Neon, Supabase, Render or when sslmode=require)
const isSslRequired = config.databaseUrl.includes('sslmode=require') || 
                      config.databaseUrl.includes('supabase.co') || 
                      config.databaseUrl.includes('neon.tech') ||
                      config.isProduction;

export const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: isSslRequired ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
});

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  const start = Date.now();
  try {
    const res = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    if (config.isDevelopment && duration > 500) {
      console.warn(`Slow query executed in ${duration}ms:`, { text, duration });
    }
    return res;
  } catch (error) {
    console.error('Database query error:', { text, error });
    throw error;
  }
}

export async function withTransaction<T>(
  callback: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function checkDbHealth(): Promise<{ status: 'connected' | 'disconnected'; error?: string }> {
  try {
    await pool.query('SELECT 1');
    return { status: 'connected' };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 'disconnected', error: message };
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}
