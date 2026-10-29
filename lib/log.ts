/**
 * One-line JSON logs, the shape most log drains expect. No dependency: the
 * fields are few and a request id is the only context worth threading.
 */
type Level = "info" | "warn" | "error"

export interface Logger {
  info: (msg: string, fields?: Record<string, unknown>) => void
  warn: (msg: string, fields?: Record<string, unknown>) => void
  error: (msg: string, fields?: Record<string, unknown>) => void
}

function emit(level: Level, base: Record<string, unknown>, msg: string, fields?: Record<string, unknown>) {
  const line = JSON.stringify({ level, time: new Date().toISOString(), msg, ...base, ...fields })
  if (level === "error") console.error(line)
  else if (level === "warn") console.warn(line)
  else console.log(line)
}

export function logger(base: Record<string, unknown> = {}): Logger {
  return {
    info: (msg, fields) => emit("info", base, msg, fields),
    warn: (msg, fields) => emit("warn", base, msg, fields),
    error: (msg, fields) => emit("error", base, msg, fields),
  }
}

/** Request id from the platform (Vercel sets x-vercel-id) or a fresh one. */
export function requestId(headers: Headers): string {
  return headers.get("x-request-id") ?? headers.get("x-vercel-id") ?? crypto.randomUUID()
}

export function describeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) return { error: error.message, stack: error.stack?.split("\n").slice(0, 4).join(" | ") }
  return { error: String(error) }
}
