import { NextResponse } from "next/server"
import type { AppError } from "@/lib/domain/result"
import { HTTP_STATUS } from "@/lib/domain/result"

const MAX_BODY_BYTES = 64 * 1024

/** Parse a small JSON body, refusing oversized or malformed payloads before any schema runs. */
export async function readJsonBody(request: Request): Promise<unknown | null> {
  const declared = Number(request.headers.get("content-length") ?? 0)
  if (declared > MAX_BODY_BYTES) return null
  const text = await request.text().catch(() => "")
  if (text.length > MAX_BODY_BYTES) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

export function errorResponse(error: AppError, headers?: HeadersInit): NextResponse {
  return NextResponse.json({ error }, { status: HTTP_STATUS[error.code], headers })
}
