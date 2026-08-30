import { pool, checkDbHealth } from './index.js';
import { AuthService } from '../services/auth.service.js';
import { Role, Stage, OpeningStatus, EventType } from '../types/index.js';

export async function seedDatabase(): Promise<void> {
  console.log('🌱 Checking database connection for seeding...');
  const health = await checkDbHealth();
  if (health.status !== 'connected') {
    throw new Error(`Database connection failed: ${health.error}`);
  }

  console.log('👤 Seeding default users...');
  const defaultPassword = 'password123';
  const passwordHash = await AuthService.hashPassword(defaultPassword);

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
       ON CONFLICT (email) DO UPDATE 
       SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash, role = EXCLUDED.role`,
      [u.id, u.name, u.email, passwordHash, u.role]
    );
  }

  console.log('💼 Seeding sample job openings...');
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
  ];

  for (const j of openings) {
    await pool.query(
      `INSERT INTO job_openings (id, title, department, description, status)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO NOTHING`,
      [j.id, j.title, j.department, j.description, j.status]
    );
  }

  console.log('📝 Seeding sample applications and panel assignments...');
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
  ];

  for (const a of applications) {
    await pool.query(
      `INSERT INTO applications (id, job_opening_id, candidate_name, candidate_email, source, notes, current_stage)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO NOTHING`,
      [a.id, a.job_opening_id, a.candidate_name, a.candidate_email, a.source, a.notes, a.current_stage]
    );
  }

  // Assign interviewer to David Kim
  await pool.query(
    `INSERT INTO application_interviewers (application_id, user_id)
     VALUES ('app_cand_01', 'usr_interviewer_01')
     ON CONFLICT (application_id, user_id) DO NOTHING`
  );

  console.log('✅ Database seeded successfully with demo accounts:');
  console.log('   - Recruiter:   recruiter@hireflow.test / password123');
  console.log('   - Interviewer: interviewer@hireflow.test / password123');
  console.log('   - Interviewer: interviewer2@hireflow.test / password123');
}

// Allow direct execution via CLI
if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  seedDatabase()
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('❌ Seeding failed:', err);
      await pool.end();
      process.exit(1);
    });
}
