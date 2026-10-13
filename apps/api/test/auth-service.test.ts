import { describe, expect, it } from "vitest";
import { hashPassword } from "../src/auth/password";
import { AuthService, type AuthRepository, type StoredSession, type StoredUser } from "../src/auth/auth.service";

class MemoryAuthRepository implements AuthRepository {
  users: StoredUser[] = [];
  sessions: StoredSession[] = [];

  findUserByEmail(emailNormalized: string) {
    return Promise.resolve(this.users.find((user) => user.emailNormalized === emailNormalized) ?? null);
  }

  createSession(session: StoredSession) {
    this.sessions.push(session);
    return Promise.resolve();
  }

  findSessionByHash(tokenHash: string) {
    return Promise.resolve(this.sessions.find((session) => session.tokenHash === tokenHash) ?? null);
  }

  touchSession(tokenHash: string, idleExpiresAt: Date) {
    const session = this.sessions.find((item) => item.tokenHash === tokenHash);
    if (session) session.idleExpiresAt = idleExpiresAt;
    return Promise.resolve();
  }

  revokeSession(tokenHash: string) {
    const session = this.sessions.find((item) => item.tokenHash === tokenHash);
    if (session) session.revokedAt = new Date();
    return Promise.resolve();
  }

  revokeAllUserSessions(userId: string) {
    for (const session of this.sessions.filter((item) => item.userId === userId)) {
      session.revokedAt = new Date();
    }
    return Promise.resolve();
  }

  findUserById(userId: string) {
    return Promise.resolve(this.users.find((user) => user.id === userId) ?? null);
  }
}

async function fixture() {
  const repository = new MemoryAuthRepository();
  repository.users.push({
    id: "member-1",
    emailNormalized: "member@example.com",
    displayName: "Thành viên",
    passwordHash: await hashPassword("correct-password"),
    role: "MEMBER",
    status: "ACTIVE",
  });
  return { repository, auth: new AuthService(repository, "test-session-secret-at-least-32-chars") };
}

describe("AuthService", () => {
  it("creates an opaque session for valid active credentials", async () => {
    const { auth, repository } = await fixture();
    const result = await auth.login(" MEMBER@EXAMPLE.COM ", "correct-password");
    expect(result.token).toBeTruthy();
    expect(result.profile).toMatchObject({ id: "member-1", role: "MEMBER" });
    expect(repository.sessions).toHaveLength(1);
    expect(repository.sessions[0].tokenHash).not.toBe(result.token);
  });

  it("rejects invalid credentials without revealing which field failed", async () => {
    const { auth } = await fixture();
    await expect(auth.login("member@example.com", "wrong")).rejects.toThrow("INVALID_CREDENTIALS");
    await expect(auth.login("missing@example.com", "wrong")).rejects.toThrow("INVALID_CREDENTIALS");
  });

  it("rejects revoked, expired, or disabled sessions", async () => {
    const { auth, repository } = await fixture();
    const login = await auth.login("member@example.com", "correct-password");
    repository.users[0].status = "INACTIVE";
    await expect(auth.authenticate(login.token)).rejects.toThrow("SESSION_INVALID");
  });

  it("revokes the current session on logout", async () => {
    const { auth } = await fixture();
    const login = await auth.login("member@example.com", "correct-password");
    await auth.logout(login.token);
    await expect(auth.authenticate(login.token)).rejects.toThrow("SESSION_INVALID");
  });
});
