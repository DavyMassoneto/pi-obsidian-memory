import { appendFileSync, mkdirSync } from "node:fs"
import { dirname, join } from "node:path"

import { CAPTURE_LOG_FILE_NAME, MAX_LOG_STRING } from "./constants.ts"
import type { CaptureLogEntry } from "./types.ts"

export function captureLogPath(configPath: string): string {
  return join(dirname(configPath), CAPTURE_LOG_FILE_NAME)
}

export function truncateLog(text: string): string {
  if (text.length <= MAX_LOG_STRING) return text
  return `${text.slice(0, MAX_LOG_STRING)}...`
}

function truncatedEntry(entry: CaptureLogEntry): CaptureLogEntry {
  return {
    ...entry,
    decisions: entry.decisions.map((decision) => ({
      ...decision,
      ...(decision.title && { title: truncateLog(decision.title) }),
      ...(decision.scopeReason && { scopeReason: truncateLog(decision.scopeReason) }),
      ...(decision.error && { error: truncateLog(decision.error) }),
      ...(decision.applied && { applied: truncateLog(decision.applied) }),
    })),
    ...(entry.problems && { problems: entry.problems.map(truncateLog) }),
  }
}

export function appendCaptureLog(logPath: string, entry: CaptureLogEntry): void {
  try {
    mkdirSync(dirname(logPath), { recursive: true })
    appendFileSync(logPath, `${JSON.stringify(truncatedEntry(entry))}\n`, "utf8")
  } catch {
    // Logging must never break capture.
  }
}
