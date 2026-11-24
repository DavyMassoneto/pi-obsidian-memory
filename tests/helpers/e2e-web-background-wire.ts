import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"

import Type, { type Static, type TSchema } from "typebox"
import { Check } from "typebox/value"

const eventEnvelope = Type.Object({ type: Type.String() })
const startupError = Type.Object({ type: Type.Literal("startup_error"), errorMessage: Type.String() })

function decode<T extends TSchema>(schema: T, text: string, source: string): Static<T> {
  try {
    const value = JSON.parse(text)
    if (Check(schema, value)) return value
  } catch {
    throw new Error(`Invalid JSON in ${source}`)
  }
  throw new Error(`Unexpected data in ${source}`)
}

export async function webRequest<T extends TSchema>(
  schema: T,
  base: string,
  path: string,
  method: string,
  body?: object,
): Promise<Static<T>> {
  const init: RequestInit = { method, headers: { "content-type": "application/json" } }
  if (body) init.body = JSON.stringify(body)
  const response = await fetch(base + path, init)
  const responseText = await response.text()
  if (!response.ok) {
    const detail = safeWebError(responseText)
    throw new Error(`Pi Web ${method} ${path}: HTTP ${response.status}: ${detail}`)
  }
  return decode(schema, responseText, `Pi Web ${method} ${path}`)
}

export function safeWebError(message: string): string {
  let redacted = message
  for (const secret of [process.env.OMNIROUTE_API_KEY, process.env.TYPESAFE_API_KEY, process.env.OMNIROUTE_URL]) {
    if (secret?.trim()) redacted = redacted.replaceAll(secret.trim(), "[redacted]")
  }
  return redacted.slice(0, 500)
}

function selectedEvent<T extends TSchema>(schema: T, frame: string): Static<T> | undefined {
  if (!frame.startsWith("data: ")) return undefined
  const value = decode(eventEnvelope, frame.slice(6), "Pi Web SSE")
  if (Check(startupError, value)) throw new Error(`Pi Web SSE startup: ${safeWebError(value.errorMessage)}`)
  if (Check(schema, value)) return value
  if (["connected", "agent_settled", "message_end"].includes(value.type)) {
    throw new Error(`Unexpected Pi Web SSE event: ${value.type}`)
  }
  return undefined
}

export async function* webEvents<T extends TSchema>(
  schema: T,
  base: string,
  id: string,
  signal: AbortSignal,
): AsyncGenerator<Static<T>> {
  const response = await fetch(`${base}/api/agent/${id}/events`, { signal })
  if (!response.ok || !response.body) throw new Error(`Pi Web SSE: HTTP ${response.status}`)
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let pending = ""
  try {
    for (;;) {
      const chunk = await reader.read()
      if (chunk.done) return
      pending += decoder.decode(chunk.value, { stream: true })
      let boundary = pending.indexOf("\n\n")
      while (boundary >= 0) {
        const frame = pending.slice(0, boundary)
        pending = pending.slice(boundary + 2)
        const event = selectedEvent(schema, frame)
        if (event) yield event
        boundary = pending.indexOf("\n\n")
      }
    }
  } finally {
    await reader.cancel().catch(() => {})
  }
}

export async function webSessionFile(isolatedRoot: string, id: string): Promise<string> {
  const paths = await readdir(isolatedRoot, { recursive: true })
  const file = paths.find((path) => path.endsWith(`_${id}.jsonl`))
  if (!file) throw new Error(`No isolated session file for ${id}`)
  return join(isolatedRoot, file)
}

export async function readWebTimeline<T extends TSchema>(schema: T, file: string): Promise<Static<T>[]> {
  return (await readFile(file, "utf8"))
    .trim()
    .split("\n")
    .map((line) => decode(schema, line, "child session JSONL"))
}
