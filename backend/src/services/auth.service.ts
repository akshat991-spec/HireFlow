import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { query } from '../db/index.js';
import { Role, User, UserPublic, AuthUserPayload } from '../types/index.js';
import { UnauthorizedError, NotFoundError } from '../errors/AppError.js';

// Auth logic — hashing, JWT, registration, login
export class AuthService {
  static async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  // Compares plaintext against stored bcrypt hash
  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  // Signs a 7-day JWT with user id, email, name, role
  static generateToken(user: AuthUserPayload): string {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      config.secretKey,
      { expiresIn: '7d' }
    );
  }

  // Verifies token and returns payload; throws if invalid or expired
  static verifyToken(token: string): AuthUserPayload {
    try {
      const decoded = jwt.verify(token, config.secretKey) as AuthUserPayload;
      return decoded;
    } catch (err) {
      throw new UnauthorizedError('Invalid or expired authentication session');
    }
  }

  // Creates a new user; auto-assigns interviewers to 3 open applications
  static async register(
    name: string,
    email: string,
    password: string,
    role: Role,
    dbQuery: typeof query = query
  ): Promise<{ user: UserPublic; token: string }> {
    const existing = await dbQuery<User>(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
      [email.trim()]
    );

    if (existing.rows.length > 0) {
      const { ValidationError } = await import('../errors/AppError.js');
      throw new ValidationError('An account with this email address already exists');
    }

    const passwordHash = await this.hashPassword(password);
    const userId = 'usr_' + Math.random().toString(36).substring(2, 11);
    const now = new Date();

    await dbQuery(
      `INSERT INTO users (id, name, email, password_hash, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, name.trim(), email.trim().toLowerCase(), passwordHash, role, now, now]
    );

    if (role === Role.INTERVIEWER) {
      try {
        const sampleApps = await dbQuery<{ id: string }>(
          `SELECT a.id 
           FROM applications a 
           JOIN job_openings j ON a.job_opening_id = j.id 
           WHERE j.status = 'OPEN' 
             AND a.current_stage IN ('INTERVIEW', 'SCREENING', 'OFFER')
           ORDER BY a.applied_date DESC
           LIMIT 3`
        );

        for (const app of sampleApps.rows) {
          await dbQuery(
            `INSERT INTO application_interviewers (application_id, user_id, assigned_at)
             VALUES ($1, $2, $3)
             ON CONFLICT (application_id, user_id) DO NOTHING`,
            [app.id, userId, now]
          );

          const eventId = Math.random().toString(36).substring(2, 15);
          await dbQuery(
            `INSERT INTO timeline_events (id, application_id, event_type, actor_id, note_content, created_at)
             VALUES ($1, $2, 'INTERVIEWER_ASSIGNED', $3, $4, $5)`,
            [eventId, app.id, userId, `Assigned ${name.trim()} (${role}) to interview panel`, now]
          );
        }
      } catch (assignErr) {
        console.warn('Could not auto-assign sample candidates to new interviewer:', assignErr);
      }
    }

    const authPayload: AuthUserPayload = {
      id: userId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role,
    };

    const token = this.generateToken(authPayload);

    return {
      user: {
        id: userId,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role,
        created_at: now,
      },
      token,
    };
  }

  // Validates credentials and returns user + signed JWT
  static async login(
    email: string,
    password: string,
    dbQuery: typeof query = query
  ): Promise<{ user: UserPublic; token: string }> {
    const res = await dbQuery<User>(
      'SELECT id, name, email, password_hash, role, created_at, updated_at FROM users WHERE LOWER(email) = LOWER($1)',
      [email.trim()]
    );

    if (res.rows.length === 0) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const user = res.rows[0];
    const isMatch = await this.verifyPassword(password, user.password_hash);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const authPayload: AuthUserPayload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    const token = this.generateToken(authPayload);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        created_at: user.created_at,
      },
      token,
    };
  }

  // Fetches public user fields by ID
  static async getUserById(
    id: string,
    dbQuery: typeof query = query
  ): Promise<UserPublic> {
    const res = await dbQuery<User>(
      'SELECT id, name, email, role, created_at FROM users WHERE id = $1',
      [id]
    );

    if (res.rows.length === 0) {
      throw new NotFoundError('User not found');
    }

    return res.rows[0];
  }
}
