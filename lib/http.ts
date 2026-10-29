import { NextResponse } from "next/server"
import type { AppError } from "@/lib/domain/result"
import { HTTP_STATUS } from "@/lib/domain/result"

const MAX_BODY_BYTES = 64 * 1024

/**
 * Parse a small JSON body, refusing oversized or malformed payloads before any
 * schema runs. The body is read as a stream so a chunked upload is cut off at
 * the cap instead of buffered in full first.
 */
export async function readJsonBody(request: Request): Promise<unknown | null> {
  const declared = Number(request.headers.get("content-length") ?? 0)
  if (declared > MAX_BODY_BYTES || !request.body) return null
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      received += value.byteLength
      if (received > MAX_BODY_BYTES) {
        await reader.cancel()
        return null
      }
      chunks.push(value)
    }
    const text = new TextDecoder().decode(concat(chunks, received))
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

function concat(chunks: Uint8Array[], length: number): Uint8Array {
  const out = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}

export function errorResponse(error: AppError, headers?: HeadersInit): NextResponse {
  return NextResponse.json({ error }, { status: HTTP_STATUS[error.code], headers })
}
