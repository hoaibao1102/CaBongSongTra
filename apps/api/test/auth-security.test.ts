import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../src/auth/password";
import { createSessionToken, hashSessionToken } from "../src/auth/session-token";

describe("authentication primitives", () => {
  it("hashes passwords with argon2id without retaining plaintext", async () => {
    const hash = await hashPassword("a-strong-password");
    expect(hash).not.toContain("a-strong-password");
    expect(hash.startsWith("$argon2id$")).toBe(true);
    await expect(verifyPassword(hash, "a-strong-password")).resolves.toBe(true);
    await expect(verifyPassword(hash, "wrong-password")).resolves.toBe(false);
  });

  it("stores only a deterministic hash of an opaque session token", () => {
    const token = createSessionToken();
    expect(token.length).toBeGreaterThanOrEqual(43);
    expect(hashSessionToken(token)).toBe(hashSessionToken(token));
    expect(hashSessionToken(token)).not.toBe(token);
  });
});
