import { expect } from "vitest"

import { NO_MEMORY_NOTICE } from "#src/pi"
import { NotifySchema, notifySettles, recordsOf } from "./e2e-records.ts"
import type { E2eWorld } from "./e2e-world.ts"

export async function expectNoMemoryNoticeSince(world: E2eWorld, from: number): Promise<void> {
  await world.pi.waitFor(notifySettles([NO_MEMORY_NOTICE]), from)
  await world.pi.commands()
  const notices = recordsOf(NotifySchema, world.pi.lines.slice(from))
  expect(notices.length).toBeGreaterThan(0)
  for (const notice of notices) expect([notice.notifyType, notice.message]).toEqual(["info", NO_MEMORY_NOTICE])
}
