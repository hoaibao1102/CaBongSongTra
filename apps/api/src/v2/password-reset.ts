import { ForbiddenException, Injectable, UnauthorizedException, NotFoundException } from "@nestjs/common";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { hashPassword } from "../auth/password";
import { MongoRepository } from "./repository";
import type { Actor } from "./policy";
import type { ResetPasswordDto } from "./dto";
@Injectable()
export class PasswordResetService {
  constructor(private readonly db: MongoRepository) {}
  async issue(actor: Actor, userId: string, requestId: string) {
    if (actor.role !== "OWNER_ADMIN") throw new ForbiddenException("OWNER_REQUIRED");
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await this.db.transaction(async session => {
      const user = await this.db.users.findOne({ id: userId, status: "ACTIVE" }).session(session).lean();
      if (!user) throw new NotFoundException("RESOURCE_NOT_FOUND");
      // Write the user too, serializing reset issuance with disable/password changes.
      await this.db.users.updateOne({ id: userId, status: "ACTIVE" }, { $inc: { authVersion: 1 } }, { session });
      await this.db.resets.deleteMany({ userId }, { session });
      await this.db.resets.create([{ userId, tokenHash, expiresAt }], { session });
      await this.db.sessions.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: new Date() } }, { session });
      await this.db.audit.create([{ id: randomUUID(), actorId: actor.id, action: "PASSWORD_RESET_ISSUED", entityId: userId, requestId, createdAt: new Date() }], { session });
    });
    // Never store the plaintext token in an idempotency response or send it to logs.
    return { token, expiresAt: expiresAt.toISOString() };
  }
  async consume(dto: ResetPasswordDto, requestId: string) {
    const tokenHash = createHash("sha256").update(dto.token).digest("hex");
    const passwordHash = await hashPassword(dto.password);
    return this.db.transaction(async session => {
      const reset = await this.db.resets.findOneAndDelete({ tokenHash, expiresAt: { $gt: new Date() } }, { session }).session(session).lean();
      if (!reset) throw new UnauthorizedException("RESET_INVALID");
      const result = await this.db.users.updateOne({ id: reset.userId, status: "ACTIVE" }, { $set: { passwordHash }, $inc: { authVersion: 1 } }, { session });
      if (!result.matchedCount) throw new UnauthorizedException("RESET_INVALID");
      await this.db.sessions.updateMany({ userId: reset.userId, revokedAt: null }, { $set: { revokedAt: new Date() } }, { session });
      await this.db.audit.create([{ id: randomUUID(), actorId: reset.userId, action: "PASSWORD_RESET_COMPLETED", entityId: reset.userId, requestId, createdAt: new Date() }], { session });
      return { ok: true };
    });
  }
}
