import { NotifySchema, recordOf, recordsOf } from "./e2e-records.ts"
import type { E2eWorld } from "./e2e-world.ts"

export function noticeTexts(world: E2eWorld, from: number): string[] {
  return recordsOf(NotifySchema, world.pi.lines.slice(from)).map((notice) => notice.message)
}

type NoticeLineMatcher = (message: string) => boolean

function matchedNotice(line: string, matches: NoticeLineMatcher): string | undefined {
  return recordOf(NotifySchema, line)?.message.split("\n").find(matches)
}

export async function waitForNativeNoticeLine(
  world: E2eWorld,
  from: number,
  description: string,
  matches: NoticeLineMatcher,
): Promise<string> {
  const event = await world.pi.waitFor(
    { description, matches: (line) => typeof matchedNotice(line, matches) === "string" },
    from,
  )
  const message = matchedNotice(event, matches)
  if (typeof message !== "string") throw new Error(`RPC did not emit ${description}`)
  return message
}
