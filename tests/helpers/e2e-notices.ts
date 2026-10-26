import { NotifySchema, recordsOf } from "./e2e-records.ts"
import type { E2eWorld } from "./e2e-world.ts"

export function noticeTexts(world: E2eWorld, from: number): string[] {
  return recordsOf(NotifySchema, world.pi.lines.slice(from)).map((notice) => notice.message)
}
