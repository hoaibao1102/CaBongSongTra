import { Schema } from "mongoose";
export const SessionSchema = new Schema({ tokenHash: { type: String, required: true, unique: true }, userId: { type: String, required: true, index: true }, idleExpiresAt: { type: Date, required: true }, absoluteExpiresAt: { type: Date, required: true }, revokedAt: { type: Date, default: null } }, { timestamps: true });
SessionSchema.index({ absoluteExpiresAt: 1 }, { expireAfterSeconds: 0 });
