import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { query } from '../db/index.js';
import { Role, User, UserPublic, AuthUserPayload } from '../types/index.js';
import { UnauthorizedError, NotFoundError } from '../errors/AppError.js';

export class AuthService {
  static async hashPassword(password: string): Promise<string> {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  static async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

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

  static verifyToken(token: string): AuthUserPayload {
    try {
      const decoded = jwt.verify(token, config.secretKey) as AuthUserPayload;
      return decoded;
    } catch (err) {
      throw new UnauthorizedError('Invalid or expired authentication session');
    }
  }

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
