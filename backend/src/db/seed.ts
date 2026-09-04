import { pool as defaultPool, checkDbHealth } from './index.js';
import { AuthService } from '../services/auth.service.js';
import { Role, Stage, OpeningStatus, EventType } from '../types/index.js';

export async function seedDatabase(targetPool?: any): Promise<void> {
  const activePool = targetPool || defaultPool;
  console.log('🌱 Starting comprehensive database seeding...');

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
    {
      id: 'usr_interviewer_03',
      name: 'Marcus Brody',
      email: 'interviewer3@hireflow.test',
      role: Role.INTERVIEWER,
    },
  ];

  for (const u of users) {
    await activePool.query(
      `INSERT INTO users (id, name, email, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE 
       SET name = EXCLUDED.name, email = EXCLUDED.email, password_hash = EXCLUDED.password_hash, role = EXCLUDED.role`,
      [u.id, u.name, u.email, passwordHash, u.role]
    );
  }

  const openings = [
    {
      id: 'job_eng_01',
      title: 'Senior Full Stack Engineer',
      department: 'Engineering',
      description: 'Lead backend and frontend architecture using Node.js, TypeScript, React, and PostgreSQL. Design high-throughput APIs and reliable state machines.',
      status: OpeningStatus.OPEN,
    },
    {
      id: 'job_eng_02',
      title: 'Staff Cloud Infrastructure Engineer',
      department: 'Infrastructure',
      description: 'Build automated Kubernetes clusters, Terraform infrastructure, multi-region database replication, and real-time observability pipelines.',
      status: OpeningStatus.OPEN,
    },
    {
      id: 'job_prod_01',
      title: 'Lead Product Manager',
      department: 'Product',
      description: 'Define platform vision, pipeline analytics, user engagement funnels, and enterprise ATS integrations.',
      status: OpeningStatus.OPEN,
    },
    {
      id: 'job_design_01',
      title: 'Principal Product Designer',
      department: 'Design',
      description: 'Architect intuitive hiring workflows, responsive UI design systems, interactive data visualizers, and accessibility standards.',
      status: OpeningStatus.OPEN,
    },
    {
      id: 'job_sales_01',
      title: 'Enterprise Account Executive',
      department: 'Sales',
      description: 'Drive high-value enterprise SaaS relationships, demo workflows, client expansions, and procurement negotiations.',
      status: OpeningStatus.OPEN,
    },
    {
      id: 'job_arch_01',
      title: 'Legacy QA Automation Engineer',
      department: 'Engineering',
      description: 'Archived role formerly dedicated to legacy manual test script modernization.',
      status: OpeningStatus.ARCHIVED,
    },
  ];

  for (const j of openings) {
    await activePool.query(
      `INSERT INTO job_openings (id, title, department, description, status)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE 
       SET title = EXCLUDED.title, department = EXCLUDED.department, description = EXCLUDED.description, status = EXCLUDED.status`,
      [j.id, j.title, j.department, j.description, j.status]
    );
  }

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const daysAgo = (d: number) => new Date(now - d * dayMs).toISOString();

  const applications = [

    {
      id: 'app_cand_01',
      job_opening_id: 'job_eng_01',
      candidate_name: 'David Kim',
      candidate_email: 'david.kim@techcraft.io',
      source: 'LinkedIn',
      notes: 'Strong distributed systems & state-machine experience. Stalled in interview for 14 days.',
      current_stage: Stage.INTERVIEW,
      rejected_from_stage: null,
      applied_date: daysAgo(20),
      stage_entered_at: daysAgo(14), // STALLED (>10 days)
    },
    {
      id: 'app_cand_02',
      job_opening_id: 'job_eng_01',
      candidate_name: 'Maya Patel',
      candidate_email: 'maya.patel@devnexus.net',
      source: 'Referral',
      notes: 'Excellent frontend and UI design instincts with React and TypeScript.',
      current_stage: Stage.SCREENING,
      rejected_from_stage: null,
      applied_date: daysAgo(5),
      stage_entered_at: daysAgo(3),
    },
    {
      id: 'app_cand_03',
      job_opening_id: 'job_eng_01',
      candidate_name: 'James Wilson',
      candidate_email: 'james.wilson@cloudops.org',
      source: 'Direct',
      notes: 'Extended competitive offer. Compensation package under review.',
      current_stage: Stage.OFFER,
      rejected_from_stage: null,
      applied_date: daysAgo(18),
      stage_entered_at: daysAgo(4),
    },
    {
      id: 'app_cand_04',
      job_opening_id: 'job_eng_01',
      candidate_name: 'Elena Gomez',
      candidate_email: 'elena.gomez@archdesign.io',
      source: 'GitHub',
      notes: 'Accepted offer! Starting next month as Senior Full Stack Lead.',
      current_stage: Stage.HIRED,
      rejected_from_stage: null,
      applied_date: daysAgo(30),
      stage_entered_at: daysAgo(6),
    },
    {
      id: 'app_cand_05',
      job_opening_id: 'job_eng_01',
      candidate_name: 'Liam O\'Connor',
      candidate_email: 'liam.oc@codeworks.dev',
      source: 'Career Portal',
      notes: 'Recent application submission with strong open-source portfolio.',
      current_stage: Stage.APPLIED,
      rejected_from_stage: null,
      applied_date: daysAgo(2),
      stage_entered_at: daysAgo(2),
    },
    {
      id: 'app_cand_22',
      job_opening_id: 'job_eng_01',
      candidate_name: 'Victoria Hughes',
      candidate_email: 'victoria.h@techcandidate.com',
      source: 'LinkedIn',
      notes: 'Screened out due to location / visa requirements.',
      current_stage: Stage.REJECTED,
      rejected_from_stage: Stage.SCREENING,
      applied_date: daysAgo(12),
      stage_entered_at: daysAgo(9),
    },
    {
      id: 'app_cand_25',
      job_opening_id: 'job_eng_01',
      candidate_name: 'Arthur Pendelton',
      candidate_email: 'arthur.p@logicgate.io',
      source: 'Referral',
      notes: 'Reinstated candidate. Previously paused during interview phase.',
      current_stage: Stage.INTERVIEW,
      rejected_from_stage: null,
      applied_date: daysAgo(25),
      stage_entered_at: daysAgo(1),
    },

    {
      id: 'app_cand_06',
      job_opening_id: 'job_eng_02',
      candidate_name: 'Priya Sharma',
      candidate_email: 'priya.sharma@scaleinfra.co',
      source: 'Referral',
      notes: 'Deep Kubernetes, eBPF, and AWS multi-region infrastructure expertise.',
      current_stage: Stage.INTERVIEW,
      rejected_from_stage: null,
      applied_date: daysAgo(14),
      stage_entered_at: daysAgo(5),
    },
    {
      id: 'app_cand_07',
      job_opening_id: 'job_eng_02',
      candidate_name: 'Lucas Meyer',
      candidate_email: 'lucas.meyer@devsys.de',
      source: 'LinkedIn',
      notes: 'Candidate screening review pending. Stalled in screening for 12 days.',
      current_stage: Stage.SCREENING,
      rejected_from_stage: null,
      applied_date: daysAgo(15),
      stage_entered_at: daysAgo(12), // STALLED (>10 days)
    },
    {
      id: 'app_cand_08',
      job_opening_id: 'job_eng_02',
      candidate_name: 'Noah Chen',
      candidate_email: 'noah.chen@cloudarch.com',
      source: 'Direct',
      notes: 'Automated CI/CD and Terraform specialist.',
      current_stage: Stage.APPLIED,
      rejected_from_stage: null,
      applied_date: daysAgo(3),
      stage_entered_at: daysAgo(3),
    },
    {
      id: 'app_cand_24',
      job_opening_id: 'job_eng_02',
      candidate_name: 'Gabriel Torres',
      candidate_email: 'gabriel.t@systemsdev.net',
      source: 'Direct',
      notes: 'Candidate reinstated after initial screening reconsideration.',
      current_stage: Stage.SCREENING,
      rejected_from_stage: null,
      applied_date: daysAgo(16),
      stage_entered_at: daysAgo(2),
    },

    {
      id: 'app_cand_09',
      job_opening_id: 'job_prod_01',
      candidate_name: 'Zara Al-Mansoor',
      candidate_email: 'zara.m@producthive.io',
      source: 'Tech Meetup',
      notes: 'Strong enterprise B2B product strategy and roadmap execution.',
      current_stage: Stage.INTERVIEW,
      rejected_from_stage: null,
      applied_date: daysAgo(10),
      stage_entered_at: daysAgo(4),
    },
    {
      id: 'app_cand_10',
      job_opening_id: 'job_prod_01',
      candidate_name: 'Daniel Foster',
      candidate_email: 'daniel.foster@fintechpm.com',
      source: 'Referral',
      notes: 'Former Fintech VP Product. Final offer extended.',
      current_stage: Stage.OFFER,
      rejected_from_stage: null,
      applied_date: daysAgo(22),
      stage_entered_at: daysAgo(5),
    },
    {
      id: 'app_cand_11',
      job_opening_id: 'job_prod_01',
      candidate_name: 'Rachel Green',
      candidate_email: 'rachel.green@saasproduct.org',
      source: 'LinkedIn',
      notes: 'Hired as Lead Product Manager for Analytics track.',
      current_stage: Stage.HIRED,
      rejected_from_stage: null,
      applied_date: daysAgo(35),
      stage_entered_at: daysAgo(8),
    },
    {
      id: 'app_cand_12',
      job_opening_id: 'job_prod_01',
      candidate_name: 'Chloe Bennett',
      candidate_email: 'chloe.b@productlead.co',
      source: 'Direct',
      notes: 'Applicant portfolio under initial review.',
      current_stage: Stage.APPLIED,
      rejected_from_stage: null,
      applied_date: daysAgo(1),
      stage_entered_at: daysAgo(1),
    },
    {
      id: 'app_cand_23',
      job_opening_id: 'job_prod_01',
      candidate_name: 'Kevin Larson',
      candidate_email: 'kevin.l@codeforge.io',
      source: 'Referral',
      notes: 'Interview loop completed; decided not to proceed to offer stage.',
      current_stage: Stage.REJECTED,
      rejected_from_stage: Stage.INTERVIEW,
      applied_date: daysAgo(19),
      stage_entered_at: daysAgo(7),
    },

    {
      id: 'app_cand_13',
      job_opening_id: 'job_design_01',
      candidate_name: 'Olivia Taylor',
      candidate_email: 'olivia.t@designstudio.art',
      source: 'Dribbble',
      notes: 'Extended interview loop with design exercise. Stalled alert dismissed by recruiter.',
      current_stage: Stage.INTERVIEW,
      rejected_from_stage: null,
      applied_date: daysAgo(21),
      stage_entered_at: daysAgo(15), // Stalled 15d, but DISMISSED
    },
    {
      id: 'app_cand_14',
      job_opening_id: 'job_design_01',
      candidate_name: 'Ethan Wright',
      candidate_email: 'ethan.wright@uxcraft.io',
      source: 'Referral',
      notes: 'Exceptional UX research case studies and design system documentation.',
      current_stage: Stage.SCREENING,
      rejected_from_stage: null,
      applied_date: daysAgo(6),
      stage_entered_at: daysAgo(4),
    },
    {
      id: 'app_cand_15',
      job_opening_id: 'job_design_01',
      candidate_name: 'Sofia Martinez',
      candidate_email: 'sofia.m@designlab.org',
      source: 'LinkedIn',
      notes: 'Offer package sent for Principal Design Lead.',
      current_stage: Stage.OFFER,
      rejected_from_stage: null,
      applied_date: daysAgo(16),
      stage_entered_at: daysAgo(3),
    },
    {
      id: 'app_cand_16',
      job_opening_id: 'job_design_01',
      candidate_name: 'Benjamin Scott',
      candidate_email: 'ben.scott@interface.dev',
      source: 'University Fair',
      notes: 'Promising design portfolio with focus on web accessibility.',
      current_stage: Stage.APPLIED,
      rejected_from_stage: null,
      applied_date: daysAgo(4),
      stage_entered_at: daysAgo(4),
    },

    {
      id: 'app_cand_17',
      job_opening_id: 'job_sales_01',
      candidate_name: 'Marcus Vance',
      candidate_email: 'marcus.vance@salescloud.net',
      source: 'LinkedIn',
      notes: 'Top performing enterprise sales executive. Strong presentation skills.',
      current_stage: Stage.INTERVIEW,
      rejected_from_stage: null,
      applied_date: daysAgo(11),
      stage_entered_at: daysAgo(5),
    },
    {
      id: 'app_cand_18',
      job_opening_id: 'job_sales_01',
      candidate_name: 'Isabella Rossi',
      candidate_email: 'isabella.r@growthsales.eu',
      source: 'Direct',
      notes: 'EMEA enterprise sales lead with $2M+ ARR track record.',
      current_stage: Stage.SCREENING,
      rejected_from_stage: null,
      applied_date: daysAgo(8),
      stage_entered_at: daysAgo(6),
    },
    {
      id: 'app_cand_19',
      job_opening_id: 'job_sales_01',
      candidate_name: 'William Zhang',
      candidate_email: 'william.z@enterprisesale.com',
      source: 'Referral',
      notes: 'Hired for Strategic Enterprise Accounts territory.',
      current_stage: Stage.HIRED,
      rejected_from_stage: null,
      applied_date: daysAgo(28),
      stage_entered_at: daysAgo(10),
    },
    {
      id: 'app_cand_20',
      job_opening_id: 'job_sales_01',
      candidate_name: 'Hannah Abbott',
      candidate_email: 'hannah.a@corpsales.io',
      source: 'Career Portal',
      notes: 'Outbound SDR applying for Account Executive transition.',
      current_stage: Stage.APPLIED,
      rejected_from_stage: null,
      applied_date: daysAgo(3),
      stage_entered_at: daysAgo(3),
    },

    {
      id: 'app_cand_21',
      job_opening_id: 'job_arch_01',
      candidate_name: 'Samuel Brooks',
      candidate_email: 'sam.brooks@legacytest.org',
      source: 'Direct',
      notes: 'Candidate in archived opening. Preserved in database history.',
      current_stage: Stage.APPLIED,
      rejected_from_stage: null,
      applied_date: daysAgo(40),
      stage_entered_at: daysAgo(40),
    },
  ];

  for (const a of applications) {
    await activePool.query(
      `INSERT INTO applications (id, job_opening_id, candidate_name, candidate_email, source, notes, current_stage, rejected_from_stage, applied_date, stage_entered_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO UPDATE 
       SET job_opening_id = EXCLUDED.job_opening_id, candidate_name = EXCLUDED.candidate_name,
           candidate_email = EXCLUDED.candidate_email, source = EXCLUDED.source, notes = EXCLUDED.notes,
           current_stage = EXCLUDED.current_stage, rejected_from_stage = EXCLUDED.rejected_from_stage,
           applied_date = EXCLUDED.applied_date, stage_entered_at = EXCLUDED.stage_entered_at`,
      [
        a.id,
        a.job_opening_id,
        a.candidate_name,
        a.candidate_email,
        a.source,
        a.notes,
        a.current_stage,
        a.rejected_from_stage,
        a.applied_date,
        a.stage_entered_at,
      ]
    );
  }

  const panelAssignments = [
    { appId: 'app_cand_01', userId: 'usr_interviewer_01' }, // David Kim -> Alex Rivera
    { appId: 'app_cand_02', userId: 'usr_interviewer_01' }, // Maya Patel -> Alex Rivera
    { appId: 'app_cand_06', userId: 'usr_interviewer_01' }, // Priya Sharma -> Alex Rivera
    { appId: 'app_cand_06', userId: 'usr_interviewer_02' }, // Priya Sharma -> Elena Rostova (MULTI-PANEL)
    { appId: 'app_cand_09', userId: 'usr_interviewer_02' }, // Zara Al-Mansoor -> Elena Rostova
    { appId: 'app_cand_09', userId: 'usr_interviewer_03' }, // Zara Al-Mansoor -> Marcus Brody (MULTI-PANEL)
    { appId: 'app_cand_13', userId: 'usr_interviewer_01' }, // Olivia Taylor -> Alex Rivera
    { appId: 'app_cand_17', userId: 'usr_interviewer_01' }, // Marcus Vance -> Alex Rivera
    { appId: 'app_cand_17', userId: 'usr_interviewer_03' }, // Marcus Vance -> Marcus Brody (MULTI-PANEL)
    { appId: 'app_cand_23', userId: 'usr_interviewer_02' }, // Kevin Larson -> Elena Rostova
    { appId: 'app_cand_25', userId: 'usr_interviewer_01' }, // Arthur Pendelton -> Alex Rivera
    { appId: 'app_cand_25', userId: 'usr_interviewer_02' }, // Arthur Pendelton -> Elena Rostova (MULTI-PANEL)
  ];

  for (const p of panelAssignments) {
    await activePool.query(
      `INSERT INTO application_interviewers (application_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (application_id, user_id) DO NOTHING`,
      [p.appId, p.userId]
    );
  }

  const timelineEvents = [

    {
      id: 'evt_01_01',
      appId: 'app_cand_01',
      type: EventType.APPLICATION_CREATED,
      actorId: 'usr_recruiter_01',
      oldStage: null,
      newStage: Stage.APPLIED,
      note: 'Application received via LinkedIn sourcing campaign.',
      createdAt: daysAgo(20),
    },
    {
      id: 'evt_01_02',
      appId: 'app_cand_01',
      type: EventType.STAGE_CHANGE,
      actorId: 'usr_recruiter_01',
      oldStage: Stage.APPLIED,
      newStage: Stage.SCREENING,
      note: 'Resume passed initial qualification criteria.',
      createdAt: daysAgo(17),
    },
    {
      id: 'evt_01_03',
      appId: 'app_cand_01',
      type: EventType.INTERVIEWER_ASSIGNED,
      actorId: 'usr_recruiter_01',
      oldStage: null,
      newStage: null,
      note: 'Assigned Alex Rivera to technical architecture interview panel.',
      createdAt: daysAgo(15),
    },
    {
      id: 'evt_01_04',
      appId: 'app_cand_01',
      type: EventType.STAGE_CHANGE,
      actorId: 'usr_recruiter_01',
      oldStage: Stage.SCREENING,
      newStage: Stage.INTERVIEW,
      note: 'Advanced to technical interview loop.',
      createdAt: daysAgo(14),
    },
    {
      id: 'evt_01_05',
      appId: 'app_cand_01',
      type: EventType.INTERVIEWER_FEEDBACK,
      actorId: 'usr_interviewer_01',
      oldStage: null,
      newStage: null,
      note: 'Strong grasp of concurrent algorithms and PostgreSQL indexing strategies. Recommend advancing to system design.',
      createdAt: daysAgo(10),
    },

    {
      id: 'evt_03_01',
      appId: 'app_cand_03',
      type: EventType.APPLICATION_CREATED,
      actorId: 'usr_recruiter_01',
      oldStage: null,
      newStage: Stage.APPLIED,
      note: 'Direct application from senior engineer candidate.',
      createdAt: daysAgo(18),
    },
    {
      id: 'evt_03_02',
      appId: 'app_cand_03',
      type: EventType.STAGE_CHANGE,
      actorId: 'usr_recruiter_01',
      oldStage: Stage.APPLIED,
      newStage: Stage.SCREENING,
      note: 'Initial phone screen completed with recruiter.',
      createdAt: daysAgo(15),
    },
    {
      id: 'evt_03_03',
      appId: 'app_cand_03',
      type: EventType.STAGE_CHANGE,
      actorId: 'usr_recruiter_01',
      oldStage: Stage.SCREENING,
      newStage: Stage.INTERVIEW,
      note: 'Technical loop scheduled with engineering panel.',
      createdAt: daysAgo(10),
    },
    {
      id: 'evt_03_04',
      appId: 'app_cand_03',
      type: EventType.STAGE_CHANGE,
      actorId: 'usr_recruiter_01',
      oldStage: Stage.INTERVIEW,
      newStage: Stage.OFFER,
      note: 'Unanimous hire recommendation from all panel interviewers. Offer extended.',
      createdAt: daysAgo(4),
    },

    {
      id: 'evt_04_01',
      appId: 'app_cand_04',
      type: EventType.APPLICATION_CREATED,
      actorId: 'usr_recruiter_01',
      oldStage: null,
      newStage: Stage.APPLIED,
      note: 'Sourced from GitHub open source contributions.',
      createdAt: daysAgo(30),
    },
    {
      id: 'evt_04_02',
      appId: 'app_cand_04',
      type: EventType.STAGE_CHANGE,
      actorId: 'usr_recruiter_01',
      oldStage: Stage.APPLIED,
      newStage: Stage.SCREENING,
      note: 'Portfolio and architectural code samples validated.',
      createdAt: daysAgo(26),
    },
    {
      id: 'evt_04_03',
      appId: 'app_cand_04',
      type: EventType.STAGE_CHANGE,
      actorId: 'usr_recruiter_01',
      oldStage: Stage.SCREENING,
      newStage: Stage.INTERVIEW,
      note: 'Full virtual onsite panel completed.',
      createdAt: daysAgo(18),
    },
    {
      id: 'evt_04_04',
      appId: 'app_cand_04',
      type: EventType.STAGE_CHANGE,
      actorId: 'usr_recruiter_01',
      oldStage: Stage.INTERVIEW,
      newStage: Stage.OFFER,
      note: 'Competitive compensation package extended.',
      createdAt: daysAgo(10),
    },
    {
      id: 'evt_04_05',
      appId: 'app_cand_04',
      type: EventType.STAGE_CHANGE,
      actorId: 'usr_recruiter_01',
      oldStage: Stage.OFFER,
      newStage: Stage.HIRED,
      note: 'Offer signed! Completed onboarding checklist.',
      createdAt: daysAgo(6),
    },

    {
      id: 'evt_06_01',
      appId: 'app_cand_06',
      type: EventType.APPLICATION_CREATED,
      actorId: 'usr_recruiter_01',
      oldStage: null,
      newStage: Stage.APPLIED,
      note: 'Employee referral from senior infrastructure team.',
      createdAt: daysAgo(14),
    },
    {
      id: 'evt_06_02',
      appId: 'app_cand_06',
      type: EventType.STAGE_CHANGE,
      actorId: 'usr_recruiter_01',
      oldStage: Stage.APPLIED,
      newStage: Stage.SCREENING,
      note: 'Skills matrix confirmed.',
      createdAt: daysAgo(11),
    },
    {
      id: 'evt_06_03',
      appId: 'app_cand_06',
      type: EventType.STAGE_CHANGE,
      actorId: 'usr_recruiter_01',
      oldStage: Stage.SCREENING,
      newStage: Stage.INTERVIEW,
      note: 'Moved to technical panel.',
      createdAt: daysAgo(5),
    },
    {
      id: 'evt_06_04',
      appId: 'app_cand_06',
      type: EventType.INTERVIEWER_FEEDBACK,
      actorId: 'usr_interviewer_01',
      oldStage: null,
      newStage: null,
      note: 'Superb knowledge of container networking and zero-trust security architecture.',
      createdAt: daysAgo(3),
    },
    {
      id: 'evt_06_05',
      appId: 'app_cand_06',
      type: EventType.INTERVIEWER_FEEDBACK,
      actorId: 'usr_interviewer_02',
      oldStage: null,
      newStage: null,
      note: 'Excellent live debugging and troubleshooting under simulated production outages.',
      createdAt: daysAgo(2),
    },

    {
      id: 'evt_22_01',
      appId: 'app_cand_22',
      type: EventType.APPLICATION_CREATED,
      actorId: 'usr_recruiter_01',
      oldStage: null,
      newStage: Stage.APPLIED,
      note: 'Application received.',
      createdAt: daysAgo(12),
    },
    {
      id: 'evt_22_02',
      appId: 'app_cand_22',
      type: EventType.STAGE_CHANGE,
      actorId: 'usr_recruiter_01',
      oldStage: Stage.APPLIED,
      newStage: Stage.SCREENING,
      note: 'Candidate screening started.',
      createdAt: daysAgo(10),
    },
    {
      id: 'evt_22_03',
      appId: 'app_cand_22',
      type: EventType.REJECTION,
      actorId: 'usr_recruiter_01',
      oldStage: Stage.SCREENING,
      newStage: Stage.REJECTED,
      note: 'Candidate does not meet current timezone / remote requirements.',
      createdAt: daysAgo(9),
    },

    {
      id: 'evt_23_01',
      appId: 'app_cand_23',
      type: EventType.APPLICATION_CREATED,
      actorId: 'usr_recruiter_01',
      oldStage: null,
      newStage: Stage.APPLIED,
      note: 'Referral submission.',
      createdAt: daysAgo(19),
    },
    {
      id: 'evt_23_02',
      appId: 'app_cand_23',
      type: EventType.STAGE_CHANGE,
      actorId: 'usr_recruiter_01',
      oldStage: Stage.APPLIED,
      newStage: Stage.SCREENING,
      note: 'Recruiter phone screening passed.',
      createdAt: daysAgo(16),
    },
    {
      id: 'evt_23_03',
      appId: 'app_cand_23',
      type: EventType.STAGE_CHANGE,
      actorId: 'usr_recruiter_01',
      oldStage: Stage.SCREENING,
      newStage: Stage.INTERVIEW,
      note: 'Assigned interview panel.',
      createdAt: daysAgo(12),
    },
    {
      id: 'evt_23_04',
      appId: 'app_cand_23',
      type: EventType.INTERVIEWER_FEEDBACK,
      actorId: 'usr_interviewer_02',
      oldStage: null,
      newStage: null,
      note: 'Strong presentation skills but insufficient experience with multi-tenant data modeling.',
      createdAt: daysAgo(8),
    },
    {
      id: 'evt_23_05',
      appId: 'app_cand_23',
      type: EventType.REJECTION,
      actorId: 'usr_recruiter_01',
      oldStage: Stage.INTERVIEW,
      newStage: Stage.REJECTED,
      note: 'Decided to proceed with other candidates closer to technical domain requirements.',
      createdAt: daysAgo(7),
    },

    {
      id: 'evt_24_01',
      appId: 'app_cand_24',
      type: EventType.APPLICATION_CREATED,
      actorId: 'usr_recruiter_01',
      oldStage: null,
      newStage: Stage.APPLIED,
      note: 'Direct inbound application.',
      createdAt: daysAgo(16),
    },
    {
      id: 'evt_24_02',
      appId: 'app_cand_24',
      type: EventType.STAGE_CHANGE,
      actorId: 'usr_recruiter_01',
      oldStage: Stage.APPLIED,
      newStage: Stage.SCREENING,
      note: 'Initial review commenced.',
      createdAt: daysAgo(14),
    },
    {
      id: 'evt_24_03',
      appId: 'app_cand_24',
      type: EventType.REJECTION,
      actorId: 'usr_recruiter_01',
      oldStage: Stage.SCREENING,
      newStage: Stage.REJECTED,
      note: 'Initial headcount freeze.',
      createdAt: daysAgo(10),
    },
    {
      id: 'evt_24_04',
      appId: 'app_cand_24',
      type: EventType.REINSTATEMENT,
      actorId: 'usr_recruiter_01',
      oldStage: Stage.REJECTED,
      newStage: Stage.SCREENING,
      note: 'Headcount unblocked. Candidate reinstated to active screening pipeline.',
      createdAt: daysAgo(2),
    },

    {
      id: 'evt_25_01',
      appId: 'app_cand_25',
      type: EventType.APPLICATION_CREATED,
      actorId: 'usr_recruiter_01',
      oldStage: null,
      newStage: Stage.APPLIED,
      note: 'Sourced candidate.',
      createdAt: daysAgo(25),
    },
    {
      id: 'evt_25_02',
      appId: 'app_cand_25',
      type: EventType.STAGE_CHANGE,
      actorId: 'usr_recruiter_01',
      oldStage: Stage.APPLIED,
      newStage: Stage.SCREENING,
      note: 'Screening passed.',
      createdAt: daysAgo(22),
    },
    {
      id: 'evt_25_03',
      appId: 'app_cand_25',
      type: EventType.STAGE_CHANGE,
      actorId: 'usr_recruiter_01',
      oldStage: Stage.SCREENING,
      newStage: Stage.INTERVIEW,
      note: 'Panel interview started.',
      createdAt: daysAgo(18),
    },
    {
      id: 'evt_25_04',
      appId: 'app_cand_25',
      type: EventType.REJECTION,
      actorId: 'usr_recruiter_01',
      oldStage: Stage.INTERVIEW,
      newStage: Stage.REJECTED,
      note: 'Candidate temporarily accepted another offer that fell through.',
      createdAt: daysAgo(8),
    },
    {
      id: 'evt_25_05',
      appId: 'app_cand_25',
      type: EventType.REINSTATEMENT,
      actorId: 'usr_recruiter_01',
      oldStage: Stage.REJECTED,
      newStage: Stage.INTERVIEW,
      note: 'Candidate available again. Reinstated to technical interview stage.',
      createdAt: daysAgo(1),
    },
  ];

  for (const e of timelineEvents) {
    await activePool.query(
      `INSERT INTO timeline_events (id, application_id, event_type, actor_id, old_stage, new_stage, note_content, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO UPDATE
       SET event_type = EXCLUDED.event_type, actor_id = EXCLUDED.actor_id, old_stage = EXCLUDED.old_stage,
           new_stage = EXCLUDED.new_stage, note_content = EXCLUDED.note_content, created_at = EXCLUDED.created_at`,
      [e.id, e.appId, e.type, e.actorId, e.oldStage, e.newStage, e.note, e.createdAt]
    );
  }

  await activePool.query(
    `INSERT INTO stalled_alert_dismissals (id, application_id, user_id, stage, stage_entered_at, dismissed_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (id) DO UPDATE
     SET stage_entered_at = EXCLUDED.stage_entered_at, dismissed_at = EXCLUDED.dismissed_at`,
    [
      'dsm_olivia_13',
      'app_cand_13',
      'usr_recruiter_01',
      Stage.INTERVIEW,
      daysAgo(15),
      daysAgo(2),
    ]
  );

  console.log('✅ Realistic database seed successfully loaded:');
  console.log('   - 6 Job Openings (5 active OPEN, 1 ARCHIVED)');
  console.log('   - 25 Applications across all 6 stages (APPLIED, SCREENING, INTERVIEW, OFFER, HIRED, REJECTED)');
  console.log('   - 2 Reinstated candidate examples with complete timeline audit log');
  console.log('   - Multi-interviewer assignments & evaluation feedback entries');
  console.log('   - Stalled application alerts & dismissed alert examples');
  console.log('   - 4 Demo Users (1 Recruiter, 3 Interviewers with password123)');
}

if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  seedDatabase()
    .then(async () => {
      await defaultPool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('❌ Seeding failed:', err);
      await defaultPool.end();
      process.exit(1);
    });
}
