import { mkdir, readdir, readFile } from "node:fs/promises"

import { expect, test, vi } from "vitest"

import { SETUP_CREATE_OPTION } from "#src/pi"
import { fakePiContext, piRegistrationFixture, relevantPiFixture, writeAgentConfig } from "#test-helpers"

test("with no config the session offers /memory-setup", async () => {
  const { pi, workingFolder } = await piRegistrationFixture()
  const { context, notifications } = fakePiContext(workingFolder, {})

  await pi.startSession(context, "startup")

  expect(notifications).toEqual([{ message: expect.stringContaining("/memory-setup"), type: "info" }])
})

test("an invalid config shows every problem in one warning and offers /memory-setup", async () => {
  const { pi, configPath, config, workingFolder } = await piRegistrationFixture()
  await writeAgentConfig(configPath, JSON.stringify({ ...config, limits: { maxBodyChars: -1 } }))
  const { context, notifications } = fakePiContext(workingFolder, {})

  await pi.startSession(context, "startup")

  expect(notifications).toHaveLength(1)
  expect(notifications[0]?.type).toBe("warning")
  expect(notifications[0]?.message).toContain("maxBodyChars")
  expect(notifications[0]?.message).toContain("maxStatementChars")
  expect(notifications[0]?.message).toContain("/memory-setup")
})

test("a config that cannot be read is shown as a warning with its problem", async () => {
  const { pi, configPath, workingFolder } = await piRegistrationFixture()
  await mkdir(configPath, { recursive: true })
  const { context, notifications } = fakePiContext(workingFolder, {})

  await pi.startSession(context, "startup")

  expect(notifications).toEqual([{ message: expect.stringContaining(configPath), type: "warning" }])
})

test("a valid config whose memory loads starts silently", async () => {
  const { pi, workingFolder } = await relevantPiFixture({ laya: null, session: [], turns: [] })
  const { context, notifications } = fakePiContext(workingFolder, {})

  await pi.startSession(context, "startup")

  expect(notifications).toEqual([])
})

test("without a UI nothing is notified", async () => {
  const { pi, workingFolder } = await piRegistrationFixture()
  const { context, notifications } = fakePiContext(workingFolder, { hasUI: false })

  await pi.startSession(context, "startup")

  expect(notifications).toEqual([])
})

test.each([
  ["startup", 1],
  ["new", 1],
  ["resume", 1],
  ["fork", 1],
  ["reload", 0],
] as const)("on %s the notice is shown %i time(s)", async (reason, shown) => {
  const { pi, workingFolder } = await piRegistrationFixture()
  const { context, notifications } = fakePiContext(workingFolder, {})

  await pi.startSession(context, reason)

  expect(notifications).toHaveLength(shown)
})

test("a new session_start stops a command still waiting for an answer before it writes", async () => {
  const { pi, configPath, globalVault, workingFolder, root } = await piRegistrationFixture()
  const answer = Promise.withResolvers<boolean>()
  const { context, prompts } = fakePiContext(workingFolder, {
    answers: { selects: [SETUP_CREATE_OPTION], inputs: [globalVault], confirms: [answer.promise] },
  })
  await pi.startSession(context, "startup")

  const running = pi.runCommand("memory-setup", context)
  await vi.waitFor(() => expect(prompts.some((prompt) => prompt.kind === "confirm")).toBe(true))
  await pi.startSession(fakePiContext(workingFolder, { hasUI: false }).context, "new")
  answer.resolve(true)
  await running

  await expect(readFile(configPath)).rejects.toMatchObject({ code: "ENOENT" })
  expect(await readdir(root)).not.toContain("Global memory")
})
