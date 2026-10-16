import { mkdir, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test, vi } from "vitest"

import { changeLeasedMemory } from "#src/usecases"
import {
  changeFixture,
  expectRegistrationLeaseReleased,
  linkFolder,
  noteWithId,
  READIED_PATH as path,
  readiedNote,
  writeRegistrationSnapshot,
} from "#test-helpers"

const address = { vault: "global", path } as const

test("the change gets the leased vault, the context and the receipted note", async () => {
  const { context } = await readiedNote("Always pnpm.", [])
  const apply = vi.fn(async () => ({ succeeded: true }) as const)

  await changeLeasedMemory(address, context, apply)

  expect(apply).toHaveBeenCalledOnce()
  expect(apply).toHaveBeenCalledWith(
    expect.objectContaining({
      target: expect.objectContaining({ scope: "global" }),
      receipted: expect.objectContaining({ folder: "tools", note: expect.objectContaining({ statement: "Use pnpm" }) }),
    }),
  )
  await expectRegistrationLeaseReleased(context)
})

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

test("a note that was not read is refused without calling the change", async () => {
  const { context } = await readiedNote("Always pnpm.", [])
  const apply = vi.fn(async () => ({ succeeded: true }) as const)

  const result = await changeLeasedMemory({ vault: "global", path: "tools/Other.md" }, context, apply)

  expect(result).toMatchObject({ succeeded: false, reason: "not-read" })
  expect(apply).not.toHaveBeenCalled()
  await expectRegistrationLeaseReleased(context)
})

test("a folder with no registered project refuses the project vault", async () => {
  const { context, root } = await readiedNote("Always pnpm.", [])
  const apply = vi.fn(async () => ({ succeeded: true }) as const)

  const result = await changeLeasedMemory({ vault: "project", path }, { ...context, workingFolder: root }, apply)

  expect(result).toMatchObject({ succeeded: false, reason: "no-project" })
  expect(apply).not.toHaveBeenCalled()
})

test("a missing config refuses the change", async () => {
  const { context } = await readiedNote("Always pnpm.", [])
  await writeRegistrationSnapshot(context, "")
  const apply = vi.fn(async () => ({ succeeded: true }) as const)

  const result = await changeLeasedMemory(address, context, apply)

  expect(result.succeeded).toBe(false)
  expect(apply).not.toHaveBeenCalled()
  await expectRegistrationLeaseReleased(context)
})

test("a replaced session is refused without calling the change", async () => {
  const { context } = await readiedNote("Always pnpm.", [])
  context.session.invalidate(context.stamp)
  const apply = vi.fn(async () => ({ succeeded: true }) as const)

  const result = await changeLeasedMemory(address, context, apply)

  expect(result).toMatchObject({ succeeded: false, reason: "stale-session" })
  expect(apply).not.toHaveBeenCalled()
})

test("a vault alias pointed elsewhere after the read is refused as a changed vault", async () => {
  const { context, config, root, read } = await changeFixture()
  const first = join(root, "vault-one")
  const second = join(root, "vault-two")
  const alias = join(root, "vault-alias")
  for (const folder of [first, second]) {
    await mkdir(folder)
    await writeFile(join(folder, "Note.md"), noteWithId(1, "Same note.", []))
  }
  await linkFolder(first, alias)
  await writeRegistrationSnapshot(context, JSON.stringify({ ...config, global: { vault: alias } }))
  expect((await read("global", "Note.md")).succeeded).toBe(true)
  await rm(alias, { recursive: true, force: true })
  await linkFolder(second, alias)
  const apply = vi.fn(async () => ({ succeeded: true }) as const)

  const result = await changeLeasedMemory({ vault: "global", path: "Note.md" }, context, apply)

  expect(result).toMatchObject({ succeeded: false, reason: "stale-vault" })
  expect(apply).not.toHaveBeenCalled()
})
