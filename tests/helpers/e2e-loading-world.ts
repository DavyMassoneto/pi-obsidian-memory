import { expect } from "vitest"

import { STATUS_LOADING } from "#src/pi"
import { type RecordTest, recordOf, StatusSchema } from "./e2e-records.ts"
import { statusCleared } from "./e2e-turns.ts"
import { type E2eWorld, e2eWorld } from "./e2e-world.ts"
import type { WorldOptions } from "./e2e-world-types.ts"

export const READY_PROMPT = "Reply with the single word READY and nothing else."

export function statusSet(key: string): RecordTest {
  return {
    description: `the status ${JSON.stringify(key)} set`,
    matches: (line) => {
      const status = recordOf(StatusSchema, line)
      if (!status) return false
      return status.statusKey === key && typeof status.statusText === "string"
    },
  }
}

export async function loadingWorld(options: Partial<WorldOptions>): Promise<E2eWorld> {
  const world = await e2eWorld({
    memory: "configured",
    tools: [],
    modelCache: "shared",
    capture: "after-each-turn",
    ...options,
  })
  await world.pi.waitFor(statusSet(STATUS_LOADING.key), 0)
  return world
}

export async function expectReplacementSession(world: E2eWorld, from: number): Promise<void> {
  await world.pi.waitFor(statusSet(STATUS_LOADING.key), from)
  await world.pi.waitFor(statusCleared(STATUS_LOADING.key), from)
  const turn = await world.pi.prompt(READY_PROMPT, [])
  expect(turn.disposition).toBe("started")
  expect(await world.pi.lastAssistantText()).toContain("READY")
  expect(world.pi.stderr).not.toContain("stale")
}
