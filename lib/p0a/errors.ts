import type { ErrorCode, Failure, Result, Success } from "./types";

export class P0aError extends Error {
  readonly code: ErrorCode;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(code: ErrorCode, message: string, fieldErrors?: Record<string, string[]>) {
    super(message);
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export function ok<T>(data: T, requestId = crypto.randomUUID()): Success<T> {
  return { ok: true, data, requestId };
}

export function fail(code: ErrorCode, message: string, requestId = crypto.randomUUID(), fieldErrors?: Record<string, string[]>): Failure {
  return { ok: false, error: { code, message, fieldErrors }, requestId };
}

export async function envelope<T>(work: () => Promise<T>, requestId = crypto.randomUUID()): Promise<Result<T>> {
  try {
    return ok(await work(), requestId);
  } catch (error) {
    if (error instanceof P0aError) return fail(error.code, error.message, requestId, error.fieldErrors);
    if (error instanceof Error && error.message === "Supabase environment is not configured.") return fail("INTERNAL_ERROR", error.message, requestId);
    return fail("INTERNAL_ERROR", "Unexpected server error.", requestId);
  }
}
