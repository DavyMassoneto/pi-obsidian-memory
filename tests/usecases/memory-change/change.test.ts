import { expect, test } from "vitest"

import { changeLeasedMemory } from "#src/usecases"
import { READIED_PATH as path, readiedNote } from "#test-helpers"

const address = { vault: "global", path } as const

test.each([
  { succeeded: true },
  { succeeded: false, reason: "conflict", problems: ["changed"] },
  { succeeded: false, reason: "partial", problems: ["half"] },
] as const)("the read is used up after %j", async (outcome) => {
  const { context } = await readiedNote("Always pnpm.", [])

  const result = await changeLeasedMemory(address, context, async () => outcome)
  const again = await changeLeasedMemory(address, context, async () => outcome)

  expect(result).toEqual(outcome)
  expect(again).toMatchObject({ succeeded: false, reason: "not-read" })
})

test.each(["invalid", "exists", "not-writable", "io-error"])("the read is kept after a %s refusal", async (reason) => {
  const { context } = await readiedNote("Always pnpm.", [])

  const refused = await changeLeasedMemory(address, context, async () => ({
    succeeded: false,
    reason,
    problems: ["no"],
  }))
  const next = await changeLeasedMemory(address, context, async () => ({ succeeded: true }) as const)

  expect(refused).toMatchObject({ succeeded: false, reason })
  expect(next).toEqual({ succeeded: true })
})
