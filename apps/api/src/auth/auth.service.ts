import { createHmac } from "node:crypto";
import type { Role } from "../domain";
import { createSessionToken } from "./session-token";
import { verifyPassword } from "./password";

export type StoredUser = {
  authVersion?: number;
  id: string;
  emailNormalized: string;
  displayName: string;
  passwordHash: string;
  role: Role;
  status: "ACTIVE" | "INACTIVE";
  commissionRateBps?: number;
  bankInfo?: {
    bankName?: string;
    accountNumber?: string;
    accountHolder?: string;
    note?: string;
  };
  commissionRateHistory?: Array<{
    rateBps: number;
    changedBy: string;
    changedAt: Date;
    reason?: string;
  }>;
};

export type StoredSession = {
  authVersion?: number;
  tokenHash: string;
  userId: string;
  idleExpiresAt: Date;
  absoluteExpiresAt: Date;
  revokedAt: Date | null;
};

export interface AuthRepository {
  findUserByEmail(emailNormalized: string): Promise<StoredUser | null>;
  findUserById(userId: string): Promise<StoredUser | null>;
  createSession(session: StoredSession): Promise<void>;
  findSessionByHash(tokenHash: string): Promise<StoredSession | null>;
  touchSession(tokenHash: string, idleExpiresAt: Date): Promise<void>;
  revokeSession(tokenHash: string): Promise<void>;
  revokeAllUserSessions(userId: string): Promise<void>;
}

const IDLE_MS = 30 * 60 * 1_000;
const ABSOLUTE_MS = 12 * 60 * 60 * 1_000;

export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly sessionSecret: string,
  ) {
    if (sessionSecret.length < 32) throw new Error("SESSION_SECRET_TOO_SHORT");
  }

  private tokenHash(token: string) {
    return createHmac("sha256", this.sessionSecret).update(token).digest("base64url");
  }

  private profile(user: StoredUser) {
    return {
      id: user.id,
      displayName: user.displayName,
      role: user.role,
      commissionRateBps: user.commissionRateBps ?? 4000,
    };
  }

  async login(email: string, password: string, now = new Date()) {
    const user = await this.repository.findUserByEmail(email.trim().toLowerCase());
    if (!user || user.status !== "ACTIVE" || !(await verifyPassword(user.passwordHash, password))) {
      throw new Error("INVALID_CREDENTIALS");
    }
    const token = createSessionToken();
    if (user.role === "OWNER_ADMIN" && (process.env.OWNER_MFA_ENABLED === "true" || process.env.NODE_ENV === "production")) throw new Error("OWNER_MFA_REQUIRED");
    await this.repository.createSession({
      tokenHash: this.tokenHash(token),
      userId: user.id,
      authVersion: user.authVersion ?? 0,
      idleExpiresAt: new Date(now.getTime() + IDLE_MS),
      absoluteExpiresAt: new Date(now.getTime() + ABSOLUTE_MS),
      revokedAt: null,
    });
    return { token, profile: this.profile(user) };
  }

  async authenticate(token: string, now = new Date()) {
    const tokenHash = this.tokenHash(token);
    const session = await this.repository.findSessionByHash(tokenHash);
    if (
      !session ||
      session.revokedAt ||
      session.idleExpiresAt <= now ||
      session.absoluteExpiresAt <= now
    ) {
      throw new Error("SESSION_INVALID");
    }
    const user = await this.repository.findUserById(session.userId);
    if (!user || user.status !== "ACTIVE" || (user.authVersion ?? 0) !== (session.authVersion ?? 0)) {
      await this.repository.revokeSession(tokenHash);
      throw new Error("SESSION_INVALID");
    }
    const nextIdle = new Date(Math.min(now.getTime() + IDLE_MS, session.absoluteExpiresAt.getTime()));
    if (user.role === "OWNER_ADMIN" && (process.env.OWNER_MFA_ENABLED === "true" || process.env.NODE_ENV === "production")) {
      await this.repository.revokeSession(tokenHash);
      throw new Error("OWNER_MFA_REQUIRED");
    }
    await this.repository.touchSession(tokenHash, nextIdle);
    return this.profile(user);
  }

  logout(token: string) {
    return this.repository.revokeSession(this.tokenHash(token));
  }

  revokeUser(userId: string) {
    return this.repository.revokeAllUserSessions(userId);
  }
}
