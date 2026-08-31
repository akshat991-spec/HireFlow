import pg from 'pg';
import { config } from '../config.js';

const { Pool } = pg;

// Detect if SSL should be used (e.g. for Neon, Supabase, Render or when sslmode=require)
const isSslRequired = config.databaseUrl.includes('sslmode=require') || 
                      config.databaseUrl.includes('supabase.co') || 
                      config.databaseUrl.includes('neon.tech') ||
                      config.isProduction;

export let pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: isSslRequired ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

export function setPool(customPool: any): void {
  pool = customPool;
}

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

export async function bootstrapRealDb(): Promise<void> {
  const fs = await import('fs');
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  const { AuthService } = await import('../services/auth.service.js');
  const { Role, Stage, OpeningStatus } = await import('../types/index.js');

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  let schemaPath = path.join(__dirname, 'schema.sql');
  if (!fs.existsSync(schemaPath)) {
    schemaPath = path.join(process.cwd(), 'src', 'db', 'schema.sql');
  }
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

  // Execute schema tables & indexes
  await pool.query(schemaSql);

  // Check if users exist
  const userCountRes = await pool.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM users');
  const userCount = parseInt(userCountRes.rows[0]?.count || '0', 10);

  if (userCount === 0) {
    console.log('🌱 Seeding PostgreSQL database with demo accounts & sample pipeline...');
    const passwordHash = await AuthService.hashPassword('password123');
    const users = [
      {
        id: 'usr_recruiter_01',
        name: 'Sarah Connor',
        email: 'recruiter@hireflow.test',
        role: Role.RECRUITER,
      },
      {
        id: 'usr_interviewer_01',
        name: 'Alex Rivera',
        email: 'interviewer@hireflow.test',
        role: Role.INTERVIEWER,
      },
      {
        id: 'usr_interviewer_02',
        name: 'Elena Rostova',
        email: 'interviewer2@hireflow.test',
        role: Role.INTERVIEWER,
      },
    ];

    for (const u of users) {
      await pool.query(
        `INSERT INTO users (id, name, email, password_hash, role)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO NOTHING`,
        [u.id, u.name, u.email, passwordHash, u.role]
      );
    }

    const openings = [
      {
        id: 'job_eng_01',
        title: 'Senior Full Stack Engineer',
        department: 'Engineering',
        description: 'Lead backend and frontend architecture using Node.js, TypeScript, and React.',
        status: OpeningStatus.OPEN,
      },
      {
        id: 'job_prod_01',
        title: 'Senior Product Manager',
        department: 'Product',
        description: 'Drive pipeline and platform product roadmap.',
        status: OpeningStatus.OPEN,
      },
      {
        id: 'job_design_01',
        title: 'Lead Product Designer',
        department: 'Design',
        description: 'Craft user-centric interfaces and design systems.',
        status: OpeningStatus.OPEN,
      },
    ];

    for (const j of openings) {
      await pool.query(
        `INSERT INTO job_openings (id, title, department, description, status)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO NOTHING`,
        [j.id, j.title, j.department, j.description, j.status]
      );
    }

    const applications = [
      {
        id: 'app_cand_01',
        job_opening_id: 'job_eng_01',
        candidate_name: 'David Kim',
        candidate_email: 'david.kim@example.com',
        source: 'LinkedIn',
        notes: 'Strong distributed systems experience.',
        current_stage: Stage.INTERVIEW,
      },
      {
        id: 'app_cand_02',
        job_opening_id: 'job_eng_01',
        candidate_name: 'Maya Patel',
        candidate_email: 'maya.patel@example.com',
        source: 'Referral',
        notes: 'Excellent frontend and UI design instincts.',
        current_stage: Stage.SCREENING,
      },
      {
        id: 'app_cand_03',
        job_opening_id: 'job_prod_01',
        candidate_name: 'Marcus Vance',
        candidate_email: 'marcus.v@example.com',
        source: 'Direct',
        notes: 'Former fintech PM with high analytical rigor.',
        current_stage: Stage.OFFER,
      },
      {
        id: 'app_cand_04',
        job_opening_id: 'job_design_01',
        candidate_name: 'Sophia Chen',
        candidate_email: 'sophia.chen@example.com',
        source: 'LinkedIn',
        notes: 'Portfolio review was outstanding.',
        current_stage: Stage.APPLIED,
      },
    ];

    for (const a of applications) {
      await pool.query(
        `INSERT INTO applications (id, job_opening_id, candidate_name, candidate_email, source, notes, current_stage)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [a.id, a.job_opening_id, a.candidate_name, a.candidate_email, a.source, a.notes, a.current_stage]
      );
    }

    await pool.query(
      `INSERT INTO application_interviewers (application_id, user_id)
       VALUES ('app_cand_01', 'usr_interviewer_01'), ('app_cand_02', 'usr_interviewer_01')
       ON CONFLICT (application_id, user_id) DO NOTHING`
    );
  }
}

export async function initInMemoryDb(): Promise<void> {
  const { newDb } = await import('pg-mem');
  const fs = await import('fs');
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  const { AuthService } = await import('../services/auth.service.js');
  const { Role, Stage, OpeningStatus } = await import('../types/index.js');

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const memDb = newDb();
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
  memDb.public.none(schemaSql);

  const { Pool: MemPool } = memDb.adapters.createPg();
  const memPool = new MemPool();
  setPool(memPool);

  // Seed default demo accounts
  const passwordHash = await AuthService.hashPassword('password123');
  const users = [
    {
      id: 'usr_recruiter_01',
      name: 'Sarah Connor',
      email: 'recruiter@hireflow.test',
      role: Role.RECRUITER,
    },
    {
      id: 'usr_interviewer_01',
      name: 'Alex Rivera',
      email: 'interviewer@hireflow.test',
      role: Role.INTERVIEWER,
    },
    {
      id: 'usr_interviewer_02',
      name: 'Elena Rostova',
      email: 'interviewer2@hireflow.test',
      role: Role.INTERVIEWER,
    },
  ];

  for (const u of users) {
    await query(
      `INSERT INTO users (id, name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)`,
      [u.id, u.name, u.email, passwordHash, u.role]
    );
  }

  // Seed sample openings
  const openings = [
    {
      id: 'job_eng_01',
      title: 'Senior Full Stack Engineer',
      department: 'Engineering',
      description: 'Lead backend and frontend architecture using Node.js, TypeScript, and React.',
      status: OpeningStatus.OPEN,
    },
    {
      id: 'job_prod_01',
      title: 'Senior Product Manager',
      department: 'Product',
      description: 'Drive pipeline and platform product roadmap.',
      status: OpeningStatus.OPEN,
    },
    {
      id: 'job_design_01',
      title: 'Lead Product Designer',
      department: 'Design',
      description: 'Craft user-centric interfaces and design systems.',
      status: OpeningStatus.OPEN,
    },
  ];

  for (const j of openings) {
    await query(
      `INSERT INTO job_openings (id, title, department, description, status)
       VALUES ($1, $2, $3, $4, $5)`,
      [j.id, j.title, j.department, j.description, j.status]
    );
  }

  // Seed sample applications
  const applications = [
    {
      id: 'app_cand_01',
      job_opening_id: 'job_eng_01',
      candidate_name: 'David Kim',
      candidate_email: 'david.kim@example.com',
      source: 'LinkedIn',
      notes: 'Strong distributed systems experience.',
      current_stage: Stage.INTERVIEW,
    },
    {
      id: 'app_cand_02',
      job_opening_id: 'job_eng_01',
      candidate_name: 'Maya Patel',
      candidate_email: 'maya.patel@example.com',
      source: 'Referral',
      notes: 'Excellent frontend and UI design instincts.',
      current_stage: Stage.SCREENING,
    },
    {
      id: 'app_cand_03',
      job_opening_id: 'job_prod_01',
      candidate_name: 'Marcus Vance',
      candidate_email: 'marcus.v@example.com',
      source: 'Direct',
      notes: 'Former fintech PM with high analytical rigor.',
      current_stage: Stage.OFFER,
    },
    {
      id: 'app_cand_04',
      job_opening_id: 'job_design_01',
      candidate_name: 'Sophia Chen',
      candidate_email: 'sophia.chen@example.com',
      source: 'LinkedIn',
      notes: 'Portfolio review was outstanding.',
      current_stage: Stage.APPLIED,
    },
  ];

  for (const a of applications) {
    await query(
      `INSERT INTO applications (id, job_opening_id, candidate_name, candidate_email, source, notes, current_stage)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [a.id, a.job_opening_id, a.candidate_name, a.candidate_email, a.source, a.notes, a.current_stage]
    );
  }

  // Assign Alex Rivera to app_cand_01 and app_cand_02
  await query(
    `INSERT INTO application_interviewers (application_id, user_id)
     VALUES ('app_cand_01', 'usr_interviewer_01'), ('app_cand_02', 'usr_interviewer_01')`
  );
}
