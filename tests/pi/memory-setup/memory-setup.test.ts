import { mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test, vi } from "vitest"

import { SETUP_ATTACH_OPTION, SETUP_CREATE_OPTION } from "#src/pi"
import {
  customizedSettings,
  fakePiContext,
  fakeToolContext,
  piRegistrationFixture,
  textOf,
  writeAgentConfig,
} from "#test-helpers"

test("setup writes every key, creates the vault with templates and memory_add then saves into it", async () => {
  const { pi, configPath, config, workingFolder, globalVault } = await piRegistrationFixture()
  const { context, notifications } = fakePiContext(workingFolder, {
    answers: { selects: [SETUP_CREATE_OPTION], inputs: [globalVault], confirms: [true] },
  })

  await pi.runCommand("memory-setup", context)

  expect(JSON.parse(await readFile(configPath, "utf8"))).toEqual(config)
  expect(await readdir(join(globalVault, "_templates"))).toHaveLength(12)
  expect(notifications).toEqual([{ message: expect.stringContaining(globalVault), type: "info" }])
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

test("the disclosure names chat models, and also Jev and remote embeddings when chosen", async () => {
  const plain = await piRegistrationFixture()
  const plainContext = fakePiContext(plain.workingFolder, {
    answers: { selects: [SETUP_CREATE_OPTION], inputs: [plain.globalVault], confirms: [true] },
  })
  await plain.pi.runCommand("memory-setup", plainContext.context)
  const plainDisclosure = plainContext.prompts.filter((prompt) => prompt.kind === "confirm").at(-1)
  expect(plainDisclosure?.message).toContain("chat model")
  expect(plainDisclosure?.message).not.toContain("TypeSafe")
  expect(plainDisclosure?.message).not.toContain("secrets")

  const remote = await piRegistrationFixture()
  await mkdir(remote.globalVault)
  await writeAgentConfig(remote.configPath, JSON.stringify({ ...remote.config, ...customizedSettings() }))
  const remoteContext = fakePiContext(remote.workingFolder, {
    answers: { selects: [SETUP_ATTACH_OPTION], inputs: [""], confirms: [true] },
  })
  await remote.pi.runCommand("memory-setup", remoteContext.context)
  const remoteDisclosure = remoteContext.prompts.filter((prompt) => prompt.kind === "confirm").at(-1)
  expect(remoteDisclosure?.message).toContain("chat model")
  expect(remoteDisclosure?.message).toContain("TypeSafe")
  expect(remoteDisclosure?.message).toContain("secrets")
})

test.each([
  ["the mode question", () => ({ selects: [undefined], inputs: [], confirms: [] })],
  ["the vault question", () => ({ selects: [SETUP_CREATE_OPTION], inputs: [undefined], confirms: [] })],
  ["the disclosure", (vault: string) => ({ selects: [SETUP_CREATE_OPTION], inputs: [vault], confirms: [false] })],
])("cancelling or declining at %s writes nothing", async (_question, answersFor) => {
  const { pi, configPath, globalVault, workingFolder, root } = await piRegistrationFixture()
  const { context, notifications } = fakePiContext(workingFolder, { answers: answersFor(globalVault) })

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

test("a re-run attaches the current vault by default, keeps valid settings, and adds a missing key", async () => {
  const { pi, configPath, config, globalVault, workingFolder } = await piRegistrationFixture()
  await mkdir(globalVault)
  await writeFile(join(globalVault, "keep.md"), "old note")
  const { context: omitted, ...withoutContext } = { ...config, ...customizedSettings() }
  await writeAgentConfig(configPath, JSON.stringify(withoutContext))
  const { context, prompts } = fakePiContext(workingFolder, {
    model: { provider: "other", id: "other-model" },
    answers: { selects: [SETUP_ATTACH_OPTION], inputs: [""], confirms: [true, true] },
  })

  await pi.runCommand("memory-setup", context)

  expect(omitted).toBeDefined()
  expect(JSON.parse(await readFile(configPath, "utf8"))).toEqual({ ...withoutContext, context: { budgetChars: 12000 } })
  expect(prompts.find((prompt) => prompt.kind === "select")?.options[0]).toBe(SETUP_ATTACH_OPTION)
  expect(prompts.find((prompt) => prompt.kind === "input")?.message).toBe(globalVault)
  expect(prompts.find((prompt) => prompt.kind === "confirm")?.message).toContain("context")
  expect(await readFile(join(globalVault, "keep.md"), "utf8")).toBe("old note")
})

test("a re-run can point to a new vault and leaves the old one untouched", async () => {
  const { pi, configPath, config, globalVault, workingFolder, root } = await piRegistrationFixture()
  await mkdir(globalVault)
  const oldBytes = Buffer.from([0, 255, 13, 10])
  await writeFile(join(globalVault, "keep.md"), oldBytes)
  await writeAgentConfig(configPath, JSON.stringify(config))
  const newVault = join(root, "New vault")
  const { context } = fakePiContext(workingFolder, {
    answers: { selects: [SETUP_CREATE_OPTION], inputs: [newVault], confirms: [true] },
  })

  await pi.runCommand("memory-setup", context)

  expect(JSON.parse(await readFile(configPath, "utf8"))).toEqual({ ...config, global: { vault: newVault } })
  expect(await readdir(globalVault)).toEqual(["keep.md"])
  expect(await readFile(join(globalVault, "keep.md"))).toEqual(oldBytes)
  expect(await readdir(newVault)).toContain("_templates")
})

test("without a current model the user picks one of the available models", async () => {
  const chosen = { provider: "picked", id: "picked-model" }
  const { pi, configPath, globalVault, workingFolder } = await piRegistrationFixture()
  const { context, prompts } = fakePiContext(workingFolder, {
    model: undefined,
    available: [{ provider: "x", id: "y" }, chosen],
    answers: { selects: ["picked/picked-model", SETUP_CREATE_OPTION], inputs: [globalVault], confirms: [true] },
  })

  await pi.runCommand("memory-setup", context)

  const written = JSON.parse(await readFile(configPath, "utf8"))
  expect(written.capture.model).toEqual(chosen)
  expect(written.memoryAgent.model).toEqual(chosen)
  expect(prompts[0]?.options).toEqual(["x/y", "picked/picked-model"])
})

test("without a current model and none available, setup is refused", async () => {
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

  const accepted = fakePiContext(workingFolder, {
    answers: { selects: [SETUP_CREATE_OPTION], inputs: [globalVault], confirms: [true, true] },
  })
  await pi.runCommand("memory-setup", accepted.context)
  expect(JSON.parse(await readFile(configPath, "utf8")).global).toEqual({ vault: globalVault })
})

test("creating over a folder with files is refused and nothing changes", async () => {
  const { pi, configPath, globalVault, workingFolder } = await piRegistrationFixture()
  await mkdir(globalVault)
  await writeFile(join(globalVault, "mine.md"), "x")
  const { context, notifications } = fakePiContext(workingFolder, {
    answers: { selects: [SETUP_CREATE_OPTION], inputs: [globalVault] },
  })

  await pi.runCommand("memory-setup", context)

  await expect(readFile(configPath)).rejects.toMatchObject({ code: "ENOENT" })
  expect(await readdir(globalVault)).toEqual(["mine.md"])
  expect(notifications).toEqual([{ message: expect.stringContaining("attach"), type: "error" }])
})

test("a vault inside a registered project vault is refused and the config stays as it was", async () => {
  const { pi, configPath, config, globalVault, workingFolder, root } = await piRegistrationFixture()
  const projectVault = join(root, "loja-vault")
  const registered = { ...config, projects: [{ name: "loja", folder: workingFolder, vault: projectVault }] }
  await mkdir(globalVault)
  await mkdir(projectVault)
  await writeAgentConfig(configPath, JSON.stringify(registered))
  const before = await readFile(configPath, "utf8")
  const { context, notifications } = fakePiContext(workingFolder, {
    answers: { selects: [SETUP_CREATE_OPTION], inputs: [join(projectVault, "inner")], confirms: [true] },
  })

  await pi.runCommand("memory-setup", context)

  expect(await readFile(configPath, "utf8")).toBe(before)
  expect(notifications).toHaveLength(1)
  expect(notifications[0]?.type).toBe("error")
  expect(notifications[0]?.message).toContain("vaults must not be equal or nested")
})

test("shutting the session down while a question is open stops the setup before it writes", async () => {
  const { pi, configPath, globalVault, workingFolder, root } = await piRegistrationFixture()
  const answer = Promise.withResolvers<boolean>()
  const { context, prompts } = fakePiContext(workingFolder, {
    answers: { selects: [SETUP_CREATE_OPTION], inputs: [globalVault], confirms: [answer.promise] },
  })
  await pi.startSession(context, "startup")

  const running = pi.runCommand("memory-setup", context)
  await vi.waitFor(() => expect(prompts.some((prompt) => prompt.kind === "confirm")).toBe(true))
  await pi.shutdownSession()
  answer.resolve(true)
  await running

  await expect(readFile(configPath)).rejects.toMatchObject({ code: "ENOENT" })
  expect(await readdir(root)).not.toContain("Global memory")
})
