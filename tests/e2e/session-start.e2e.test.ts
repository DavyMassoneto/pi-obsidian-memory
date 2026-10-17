import { mkdir, readdir, writeFile } from "node:fs/promises"
import { dirname } from "node:path"

import { expect, test } from "vitest"

import {
  INVALID_CONFIG_NOTICE,
  MEMORY_SETUP_COMMAND,
  REPAIR_HINT,
  SETUP_CREATE_OPTION,
  SETUP_VAULT_TITLE,
  UNREADABLE_CONFIG_NOTICE,
} from "#src/pi"
import {
  agentModelStep,
  captureModelStep,
  chooseE2eModel,
  configuredWorld,
  dialogTitled,
  e2eWorld,
  expectNoMemoryNoticeSince,
  fileExists,
  modeStep,
  NotifySchema,
  noMemoryWorld,
  notifySettles,
  recordsOf,
  vaultStep,
  type WorldOptions,
} from "#test-helpers"

const fresh: WorldOptions = { memory: "none", tools: [], modelCache: "fresh", capture: "after-each-turn" }

test("an invalid config shows every problem in one warning and offers /memory-setup", async () => {
  const world = await e2eWorld(fresh)
  await mkdir(dirname(world.folders.configPath), { recursive: true })
  await writeFile(world.folders.configPath, JSON.stringify({ limits: { maxBodyChars: -1 } }))
  await world.restart()
  await world.pi.waitFor(notifySettles([INVALID_CONFIG_NOTICE]), 0)
  const notices = recordsOf(NotifySchema, world.pi.lines)
  expect(notices).toHaveLength(1)
  expect(notices[0]?.notifyType).toBe("warning")
  expect(notices[0]?.message.startsWith(INVALID_CONFIG_NOTICE)).toBe(true)
  expect(notices[0]?.message).toContain("maxBodyChars")
  expect(notices[0]?.message).toContain("maxStatementChars")
  expect(notices[0]?.message.endsWith(REPAIR_HINT)).toBe(true)
})

test("a config that cannot be read is shown as a warning with its problem", async () => {
  const world = await e2eWorld(fresh)
  await mkdir(world.folders.configPath, { recursive: true })
  await world.restart()
  await world.pi.waitFor(notifySettles([UNREADABLE_CONFIG_NOTICE]), 0)
  const notices = recordsOf(NotifySchema, world.pi.lines)
  expect(notices).toHaveLength(1)
  expect(notices[0]?.notifyType).toBe("warning")
  expect(notices[0]?.message.startsWith(UNREADABLE_CONFIG_NOTICE)).toBe(true)
  expect(notices[0]?.message).toContain(world.folders.configPath)
})

test("a valid config whose memory loads starts silently", async () => {
  const world = await configuredWorld({})
  await world.pi.commands()
  expect(recordsOf(NotifySchema, world.pi.lines)).toEqual([])
})

test("on a new session the notice is shown again", async () => {
  const world = await noMemoryWorld({})
  const from = world.pi.lines.length
  await world.pi.newSession()
  await expectNoMemoryNoticeSince(world, from)
})

test("on resume the notice is shown again", async () => {
  const world = await noMemoryWorld({ session: "saved" })
  await world.pi.prompt("Reply with the single word READY and nothing else.", [])
  const sessionFile = await world.pi.sessionFile()
  await world.pi.newSession()
  const from = world.pi.lines.length
  await world.pi.switchSession(sessionFile)
  await expectNoMemoryNoticeSince(world, from)
})

test("on fork the notice is shown again", async () => {
  const world = await noMemoryWorld({ session: "saved" })
  await world.pi.prompt("Reply with the single word READY and nothing else.", [])
  const [entryId] = await world.pi.forkEntryIds()
  if (!entryId) throw new Error("pi offers no message to fork from")
  const from = world.pi.lines.length
  await world.pi.fork(entryId)
  await expectNoMemoryNoticeSince(world, from)
})

test("a new session stops a command still waiting for an answer before it writes", async () => {
  const world = await noMemoryWorld({})
  const before = await readdir(world.folders.globalVault)
  await world.pi.beginCommand(
    `/${MEMORY_SETUP_COMMAND}`,
    [
      captureModelStep(chooseE2eModel),
      agentModelStep(chooseE2eModel),
      modeStep({ option: SETUP_CREATE_OPTION }),
      vaultStep(SETUP_VAULT_TITLE, { open: true }),
    ],
    dialogTitled(SETUP_VAULT_TITLE),
  )
  await world.pi.newSession()
  world.pi.answerOpen({ value: world.folders.globalVault })
  await world.pi.endCommand()
  expect(await fileExists(world.folders.configPath)).toBe(false)
  expect(await readdir(world.folders.globalVault)).toEqual(before)
  expect(world.pi.unexpected).toEqual([])
})
