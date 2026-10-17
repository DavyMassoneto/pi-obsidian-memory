import { mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test, vi } from "vitest"

import { SETUP_ATTACH_OPTION, SETUP_CREATE_OPTION } from "#src/pi"
import {
  customizedSettings,
  fakePiContext,
  fakeToolContext,
  piRegistrationFixture,
  repairContext,
  SCREEN,
  setupContext,
  textOf,
  writeAgentConfig,
} from "#test-helpers"

test("first setup writes every key, creates the vault with templates and memory_add then saves into it", async () => {
  const { pi, configPath, config, workingFolder, globalVault } = await piRegistrationFixture()
  const { context, notifications } = setupContext(workingFolder, [SETUP_CREATE_OPTION], { inputs: [globalVault] })

  await pi.runCommand("memory-setup", context)

  expect(JSON.parse(await readFile(configPath, "utf8"))).toEqual({
    ...config,
    decisionModel: { provider: "typesafe", model: "jev-latest" },
  })
  expect(await readdir(join(globalVault, "_templates"))).toHaveLength(12)
  expect(notifications).toEqual([
    { message: expect.stringContaining("chat model"), type: "warning" },
    { message: expect.stringContaining(globalVault), type: "info" },
  ])
  expect(notifications[1]?.message).toContain("/reload")
  const saved = await pi.tools[0]?.execute(
    "call-1",
    { scope: "global", folder: "tools", statement: "Use pnpm", type: "lesson", body: "Always.", dontForget: false },
    undefined,
    undefined,
    fakeToolContext(workingFolder),
  )
  expect(saved && textOf(saved)).toBe("Saved in Global memory: tools/Use pnpm.md")
  expect(await readdir(join(globalVault, "tools"))).toContain("Use pnpm.md")
})

test("the first-setup disclosure is a plain warning that names chat models and Jev, with no question", async () => {
  const { pi, workingFolder, globalVault } = await piRegistrationFixture()
  const { context, notifications, prompts } = setupContext(workingFolder, [SETUP_CREATE_OPTION], {
    inputs: [globalVault],
  })

  await pi.runCommand("memory-setup", context)

  const warning = notifications.find((item) => item.type === "warning")
  expect(warning?.message).toContain("chat model")
  expect(warning?.message).toContain("TypeSafe")
  expect(warning?.message).not.toContain("secrets")
  expect(prompts.filter((prompt) => prompt.kind === "confirm")).toEqual([])
})

test.each([
  ["the mode question", [undefined], []],
  ["the vault question", [SETUP_CREATE_OPTION], [undefined]],
])("cancelling at %s writes nothing", async (_question, selects, inputs) => {
  const { pi, configPath, workingFolder, root } = await piRegistrationFixture()
  const { context, notifications } = setupContext(workingFolder, selects, { inputs })

  await pi.runCommand("memory-setup", context)

  await expect(readFile(configPath)).rejects.toMatchObject({ code: "ENOENT" })
  expect(await readdir(root)).not.toContain("Global memory")
  expect(notifications.map((notification) => notification.message)).toEqual([expect.stringContaining("nothing")])
})

test("without a UI nothing is asked, written or notified", async () => {
  const { pi, configPath, workingFolder, root } = await piRegistrationFixture()
  const { context, prompts, notifications } = fakePiContext(workingFolder, { hasUI: false })

  await pi.runCommand("memory-setup", context)

  expect(prompts).toEqual([])
  expect(notifications).toEqual([])
  await expect(readFile(configPath)).rejects.toMatchObject({ code: "ENOENT" })
  expect(await readdir(root)).toEqual(["work"])
})

test("a config missing a key is repaired: valid settings stay, the missing key is added after confirmation", async () => {
  const { pi, configPath, config, globalVault, workingFolder } = await piRegistrationFixture()
  await mkdir(globalVault)
  await writeFile(join(globalVault, "keep.md"), "old note")
  const { context: omitted, ...withoutContext } = { ...config, ...customizedSettings() }
  await writeAgentConfig(configPath, JSON.stringify(withoutContext))
  const { context, prompts } = repairContext(workingFolder, [SETUP_ATTACH_OPTION], {
    inputs: [""],
    confirms: [true],
  })

  await pi.runCommand("memory-setup", context)

  expect(omitted).toBeDefined()
  expect(JSON.parse(await readFile(configPath, "utf8"))).toEqual({ ...withoutContext, context: { budgetChars: 12000 } })
  expect(prompts.filter((prompt) => prompt.kind === "select")[2]?.options[0]).toBe(SETUP_ATTACH_OPTION)
  expect(prompts.find((prompt) => prompt.kind === "input")?.message).toBe(globalVault)
  expect(prompts.find((prompt) => prompt.kind === "confirm")?.message).toContain("context")
  expect(await readFile(join(globalVault, "keep.md"), "utf8")).toBe("old note")
})

test("the settings screen can point the global vault to a new one and leaves the old one untouched", async () => {
  const { pi, configPath, config, globalVault, workingFolder, root } = await piRegistrationFixture()
  await mkdir(globalVault)
  const oldBytes = Buffer.from([0, 255, 13, 10])
  await writeFile(join(globalVault, "keep.md"), oldBytes)
  await writeAgentConfig(configPath, JSON.stringify(config))
  const newVault = join(root, "New vault")
  const { context, notifications } = fakePiContext(workingFolder, {
    answers: { selects: [`Global vault: ${globalVault}`, SETUP_CREATE_OPTION, SCREEN.done], inputs: [newVault] },
  })

  await pi.runCommand("memory-setup", context)

  expect(JSON.parse(await readFile(configPath, "utf8"))).toEqual({ ...config, global: { vault: newVault } })
  expect(await readdir(globalVault)).toEqual(["keep.md"])
  expect(await readFile(join(globalVault, "keep.md"))).toEqual(oldBytes)
  expect((await readdir(newVault)).sort()).toEqual(["Memory.base", "_templates"])
  expect(await readdir(join(newVault, "_templates"))).toHaveLength(12)
  expect(notifications.at(-1)?.message).toContain("/reload")
})

test("on a first run with no model available and none configured, setup is refused", async () => {
  const { pi, configPath, workingFolder } = await piRegistrationFixture()
  const { context, notifications } = fakePiContext(workingFolder, { model: undefined, available: [] })

  await pi.runCommand("memory-setup", context)

  await expect(readFile(configPath)).rejects.toMatchObject({ code: "ENOENT" })
  expect(notifications).toEqual([{ message: expect.stringContaining("model"), type: "error" }])
})

test("a config that is not JSON is replaced only after confirmation", async () => {
  const { pi, configPath, globalVault, workingFolder } = await piRegistrationFixture()
  await writeAgentConfig(configPath, "{malformed")
  const declined = fakePiContext(workingFolder, { answers: { confirms: [false] } })

  await pi.runCommand("memory-setup", declined.context)

  expect(await readFile(configPath, "utf8")).toBe("{malformed")
  expect(declined.prompts[0]?.message).toContain("replaced")

  const accepted = setupContext(workingFolder, [SETUP_CREATE_OPTION], { inputs: [globalVault], confirms: [true] })
  await pi.runCommand("memory-setup", accepted.context)
  expect(JSON.parse(await readFile(configPath, "utf8")).global).toEqual({ vault: globalVault })
})

test("creating over a folder with files is refused and nothing changes", async () => {
  const { pi, configPath, globalVault, workingFolder } = await piRegistrationFixture()
  await mkdir(globalVault)
  await writeFile(join(globalVault, "mine.md"), "x")
  const { context, notifications } = setupContext(workingFolder, [SETUP_CREATE_OPTION], { inputs: [globalVault] })

  await pi.runCommand("memory-setup", context)

  await expect(readFile(configPath)).rejects.toMatchObject({ code: "ENOENT" })
  expect(await readdir(globalVault)).toEqual(["mine.md"])
  expect(notifications).toEqual([{ message: expect.stringContaining("attach"), type: "error" }])
})

test("a vault inside a registered project vault is refused from the screen and the config stays as it was", async () => {
  const { pi, configPath, config, globalVault, workingFolder, root } = await piRegistrationFixture()
  const projectVault = join(root, "loja-vault")
  const registered = { ...config, projects: [{ name: "loja", folder: workingFolder, vault: projectVault }] }
  await mkdir(globalVault)
  await mkdir(projectVault)
  await writeAgentConfig(configPath, JSON.stringify(registered))
  const before = await readFile(configPath, "utf8")
  const { context, notifications } = fakePiContext(workingFolder, {
    answers: {
      selects: [`Global vault: ${globalVault}`, SETUP_CREATE_OPTION, SCREEN.done],
      inputs: [join(projectVault, "inner")],
    },
  })

  await pi.runCommand("memory-setup", context)

  expect(await readFile(configPath, "utf8")).toBe(before)
  expect(notifications).toHaveLength(1)
  expect(notifications[0]?.type).toBe("error")
  expect(notifications[0]?.message).toContain("vaults must not be equal or nested")
})

test("shutting the session down while a question is open stops the setup before it writes", async () => {
  const { pi, configPath, globalVault, workingFolder, root } = await piRegistrationFixture()
  const answer = Promise.withResolvers<string | undefined>()
  const { context, prompts } = setupContext(workingFolder, [SETUP_CREATE_OPTION], { inputs: [answer.promise] })
  await pi.startSession(context, "startup")

  const running = pi.runCommand("memory-setup", context)
  await vi.waitFor(() => expect(prompts.some((prompt) => prompt.kind === "input")).toBe(true))
  await pi.shutdownSession(context)
  answer.resolve(globalVault)
  await running

  await expect(readFile(configPath)).rejects.toMatchObject({ code: "ENOENT" })
  expect(await readdir(root)).not.toContain("Global memory")
})

test("the attach option is still offered first when a vault is already configured", async () => {
  const { pi, configPath, config, globalVault, workingFolder } = await piRegistrationFixture()
  await mkdir(globalVault)
  await writeAgentConfig(configPath, JSON.stringify(config))
  const { context, prompts } = fakePiContext(workingFolder, {
    answers: { selects: [`Global vault: ${globalVault}`, undefined, SCREEN.done], inputs: [] },
  })

  await pi.runCommand("memory-setup", context)

  expect(prompts.filter((prompt) => prompt.kind === "select")[1]?.options[0]).toBe(SETUP_ATTACH_OPTION)
})
