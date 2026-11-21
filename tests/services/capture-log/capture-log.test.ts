import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { appendCaptureLog, type CaptureLogEntry, captureLogPath } from "#src/services"

let dir = ""
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "capture-log-"))
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

const entry: CaptureLogEntry = {
  timestamp: "2026-01-01T00:00:00.000Z",
  sessionId: "s1",
  project: "proj",
  cwd: "/work",
  model: { provider: "p", id: "m" },
  cursor: { from: null, to: "e2" },
  decisions: [
    { type: "add", vault: "project", title: "a/b", scopeReason: "x".repeat(1000), accepted: true },
    { type: "add", accepted: false, error: "scopeReason is required" },
  ],
  outcome: "finished",
}

describe("capture log", () => {
  it("places the log next to config.json", () => {
    expect(captureLogPath(join(dir, "config.json"))).toBe(join(dir, "capture-log.jsonl"))
  })

  it("appends one well-formed truncated JSON line per run", () => {
    const path = captureLogPath(join(dir, "nested", "config.json"))
    appendCaptureLog(path, entry)
    appendCaptureLog(path, { ...entry, outcome: "failed" })
    const lines = readFileSync(path, "utf8").trimEnd().split("\n")
    expect(lines).toHaveLength(2)
    const [first, second] = lines.map((line) => JSON.parse(line))
    expect(first.project).toBe("proj")
    expect(first.decisions[1].error).toBe("scopeReason is required")
    expect(first.decisions[0].scopeReason.length).toBeLessThan(400)
    expect(second.outcome).toBe("failed")
  })

  it("ignores write errors", () => {
    expect(() => appendCaptureLog(dir, entry)).not.toThrow()
  })
})
