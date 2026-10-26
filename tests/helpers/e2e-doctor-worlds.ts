import { DOCTOR_TITLE } from "#src/pi"
import type { MemoryConfig } from "#src/services"
import { configuredWorld, onlyNotice, rewriteConfig } from "./e2e-config.ts"
import { runDoctor } from "./e2e-doctor-steps.ts"
import type { Notify } from "./e2e-records.ts"
import type { E2eWorld } from "./e2e-world.ts"

export const DECISION_CUTOFFS = { gateThreshold: 0.2, relevanceThreshold: 0.5 }

export async function worldOnLaya(decisionModel: MemoryConfig["decisionModel"]): Promise<E2eWorld> {
  const world = await configuredWorld({})
  await rewriteConfig(world, { decisionModel })
  await world.restart()
  return world
}

export async function doctorReport(world: Pick<E2eWorld, "pi">): Promise<Notify> {
  const turn = await runDoctor(world, [], 0)
  return onlyNotice({
    ...turn,
    notifications: turn.notifications.filter((notice) => notice.message.startsWith(DOCTOR_TITLE)),
  })
}
