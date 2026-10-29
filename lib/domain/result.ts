/**
 * Server actions and repositories never throw across the client boundary.
 * They return a Result so the UI can map codes to copy without try/catch soup.
 */
export const ERROR_CODES = [
  "VALIDATION",
  "UNAUTHORIZED",
  "NOT_FOUND",
  "DUPLICATE",
  "RATE_LIMITED",
  "UPSTREAM",
  "BLOCKED_URL",
  "INTERNAL",
] as const
export type ErrorCode = (typeof ERROR_CODES)[number]

export interface AppError {
  code: ErrorCode
  message: string
  /** Optional structured detail, e.g. the id of the existing duplicate. */
  detail?: Record<string, unknown>
}

export type Result<T> = { ok: true; data: T } | { ok: false; error: AppError }

export const ok = <T>(data: T): Result<T> => ({ ok: true, data })
export const fail = <T = never>(
  code: ErrorCode,
  message: string,
  detail?: Record<string, unknown>,
): Result<T> => ({ ok: false, error: detail ? { code, message, detail } : { code, message } })

export const HTTP_STATUS: Record<ErrorCode, number> = {
  VALIDATION: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  DUPLICATE: 409,
  RATE_LIMITED: 429,
  UPSTREAM: 502,
  BLOCKED_URL: 422,
  INTERNAL: 500,
}
