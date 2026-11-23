import { join } from "node:path"

import { isSourceRecord } from "#src/domain"
import { STATUS_LOADING } from "#src/pi"
import { configuredWorld, rewriteConfig, storedConfig } from "./e2e-config.ts"
import { NotifySchema, notifySettles, recordOf } from "./e2e-records.ts"
import type { RpcPi } from "./e2e-rpc.ts"
import { statusCleared } from "./e2e-turns.ts"
import { seedUserWordsSession, type UserWordsSeed, userWordsChatRuns, userWordsHistory } from "./user-words-session.ts"

export const COLLISION_ACK = "Reply with only ACK. Do not use tools."

interface UserWordsWorld extends UserWordsSeed {
  pi: RpcPi
  seeded: ReturnType<typeof userWordsHistory>
  chatRuns(): ReturnType<typeof userWordsChatRuns>
  history(): ReturnType<typeof userWordsHistory>
  configure(after: string, atPoolTokens?: number): Promise<void>
}

function tailTokensAfter(file: string, id: string): number {
  const records = userWordsHistory(file)
  const boundary = records.findIndex((record) => record.id === id)
  if (boundary < 0) throw new Error("The compaction boundary is not on the fixture branch")
  const tokens = records
    .slice(boundary + 1)
    .filter(isSourceRecord)
    .reduce((total, record) => total + record.tokens, 0)
  if (tokens === 0) throw new Error("The native session has no retained tail after the boundary")
  return tokens
}

async function openUserWordsSession(pi: RpcPi, file: string): Promise<void> {
  const reopening = pi.lines.length
  await pi.switchSession(file)
  await pi.waitFor(statusCleared(STATUS_LOADING.key), reopening)
}

export async function userWordsCollisionWorld(): Promise<UserWordsWorld> {
  const world = await configuredWorld({
    session: "saved",
    compactsSmallSessions: true,
    modelCache: "fresh",
    cycle: { consolidator: { poolTargetTokens: 1 } },
  })
  const { pi, folders } = world
  const seed = seedUserWordsSession(folders.cwd, join(folders.root, "seeded-sessions"))
  const seeded = userWordsHistory(seed.file)
  await openUserWordsSession(pi, seed.file)
  const configure = async (after: string, atPoolTokens?: number) => {
    const { compaction, consolidator } = await storedConfig(world)
    if (typeof atPoolTokens === "number") consolidator.atPoolTokens = atPoolTokens
    await rewriteConfig(world, {
      compaction: { ...compaction, tailTokens: tailTokensAfter(seed.file, after) },
      consolidator,
    })
    await openUserWordsSession(pi, seed.file)
  }
  return {
    ...seed,
    pi,
    seeded,
    chatRuns: () => userWordsChatRuns(seed.file),
    history: () => userWordsHistory(seed.file),
    configure,
  }
}

export async function collisionConsolidationOutcome(pi: RpcPi, from: number): Promise<string | undefined> {
  const line = await pi.waitFor(notifySettles(["Memory consolidated:", "Memory consolidation failed:"]), from)
  return recordOf(NotifySchema, line)?.message
}
