import { mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { fakePiContext, fakeToolContext, piRegistrationFixture, textOf, writeAgentConfig } from "#test-helpers"

test("init registers the folder with the default name, creates the vault with templates and memory_add saves into it", async () => {
  const { pi, configPath, config, workingFolder, root } = await piRegistrationFixture()
  await writeAgentConfig(configPath, JSON.stringify(config))
  const vault = join(root, "Loja memory")
  const { context, prompts, notifications } = fakePiContext(workingFolder, { answers: { inputs: ["", vault] } })

  await pi.runCommand("memory-init", context)

  expect(JSON.parse(await readFile(configPath, "utf8"))).toEqual({
    ...config,
    projects: [{ name: "loja", folder: workingFolder, vault }],
  })
  expect(await readdir(join(vault, "_templates"))).toHaveLength(12)
  expect(prompts[0]?.message).toBe("loja")
  expect(notifications).toEqual([{ message: expect.stringContaining("loja"), type: "info" }])
  const subfolder = join(workingFolder, "src")
  await mkdir(subfolder)
  const saved = await pi.tools[0]?.execute(
    "call-1",
    { scope: "project", folder: "tools", statement: "Use pnpm", type: "lesson", body: "Always.", dontForget: false },
    undefined,
    undefined,
    fakeToolContext(subfolder),
  )
  expect(saved && textOf(saved)).toBe("Saved in Loja memory: tools/Use pnpm.md")
})

test("a taken name, in any case, is refused and asked again", async () => {
  const { pi, configPath, config, workingFolder, root } = await piRegistrationFixture()
  const other = { name: "Shop", folder: join(root, "work", "shop"), vault: join(root, "shop-vault") }
  await writeAgentConfig(configPath, JSON.stringify({ ...config, projects: [other] }))
  const vault = join(root, "Loja memory")
  const { context, prompts, notifications } = fakePiContext(workingFolder, {
    answers: { inputs: ["SHOP", "Loja", vault] },
  })

  await pi.runCommand("memory-init", context)

  expect(prompts.filter((prompt) => prompt.kind === "input").map((prompt) => prompt.title)).toHaveLength(3)
  expect(notifications[0]).toEqual({ message: expect.stringContaining("SHOP"), type: "error" })
  expect(JSON.parse(await readFile(configPath, "utf8")).projects).toEqual([
    other,
    { name: "Loja", folder: workingFolder, vault },
  ])
})

test("in a registered folder only the vault is asked, the name is kept and the old vault is untouched", async () => {
  const { pi, configPath, config, workingFolder, root } = await piRegistrationFixture()
  const oldVault = join(root, "old-vault")
  await mkdir(oldVault)
  const oldBytes = Buffer.from([0, 255, 13, 10])
  await writeFile(join(oldVault, "keep.md"), oldBytes)
  const registered = { name: "Loja Shop", folder: workingFolder, vault: oldVault }
  await writeAgentConfig(configPath, JSON.stringify({ ...config, projects: [registered] }))
  const newVault = join(root, "new-vault")
  const { context, prompts } = fakePiContext(join(workingFolder, "src"), { answers: { inputs: [newVault] } })

  await pi.runCommand("memory-init", context)

  expect(prompts.filter((prompt) => prompt.kind === "input")).toHaveLength(1)
  expect(JSON.parse(await readFile(configPath, "utf8")).projects).toEqual([{ ...registered, vault: newVault }])
  expect(await readdir(oldVault)).toEqual(["keep.md"])
  expect(await readFile(join(oldVault, "keep.md"))).toEqual(oldBytes)
  expect(await readdir(newVault)).toContain("_templates")
})

test("without a global vault init is refused and offers /memory-setup", async () => {
  const { pi, configPath, workingFolder } = await piRegistrationFixture()
  const { context, prompts, notifications } = fakePiContext(workingFolder, {})

  await pi.runCommand("memory-init", context)

  expect(prompts).toEqual([])
  expect(notifications).toEqual([{ message: expect.stringContaining("/memory-setup"), type: "error" }])
  await expect(readFile(configPath)).rejects.toMatchObject({ code: "ENOENT" })
})

test("an invalid config refuses init with every problem and offers /memory-setup", async () => {
  const { pi, configPath, config, workingFolder } = await piRegistrationFixture()
  await writeAgentConfig(configPath, JSON.stringify({ ...config, limits: { maxBodyChars: -1 } }))
  const before = await readFile(configPath, "utf8")
  const { context, notifications } = fakePiContext(workingFolder, {})

  await pi.runCommand("memory-init", context)

  expect(notifications).toHaveLength(1)
  expect(notifications[0]?.message).toContain("maxBodyChars")
  expect(notifications[0]?.message).toContain("maxStatementChars")
  expect(notifications[0]?.message).toContain("/memory-setup")
  expect(await readFile(configPath, "utf8")).toBe(before)
})

test.each([
  ["the name", [undefined]],
  ["the vault", ["", undefined]],
])("cancelling at %s writes nothing", async (_question, inputs) => {
  const { pi, configPath, config, workingFolder, root } = await piRegistrationFixture()
  await writeAgentConfig(configPath, JSON.stringify(config))
  const before = await readFile(configPath, "utf8")
  const { context, notifications } = fakePiContext(workingFolder, { answers: { inputs } })

  await pi.runCommand("memory-init", context)

  expect(await readFile(configPath, "utf8")).toBe(before)
  expect(await readdir(root)).toEqual(["agent", "work"])
  expect(notifications.map((notification) => notification.message)).toEqual([expect.stringContaining("nothing")])
})

test("a vault nested inside another registered vault is refused and the config stays as it was", async () => {
  const { pi, configPath, config, workingFolder, root } = await piRegistrationFixture()
  await writeAgentConfig(configPath, JSON.stringify(config))
  const before = await readFile(configPath, "utf8")
  const { context, notifications } = fakePiContext(workingFolder, {
    answers: { inputs: ["", join(root, "Global memory", "inner")] },
  })

  await pi.runCommand("memory-init", context)

  expect(await readFile(configPath, "utf8")).toBe(before)
  expect(notifications).toHaveLength(1)
  expect(notifications[0]?.type).toBe("error")
  expect(notifications[0]?.message).toContain("vaults must not be equal or nested")
})

test("an unreadable config refuses init with its problem and does not offer /memory-setup", async () => {
  const { pi, configPath, workingFolder } = await piRegistrationFixture()
  await mkdir(configPath, { recursive: true })
  const { context, prompts, notifications } = fakePiContext(workingFolder, {})

  await pi.runCommand("memory-init", context)

  expect(prompts).toEqual([])
  expect(notifications).toEqual([{ message: expect.stringContaining(configPath), type: "error" }])
  expect(notifications[0]?.message).not.toContain("/memory-setup")
})

test("without a UI nothing is asked, written or notified", async () => {
  const { pi, configPath, config, workingFolder } = await piRegistrationFixture()
  await writeAgentConfig(configPath, JSON.stringify(config))
  const before = await readFile(configPath, "utf8")
  const { context, prompts, notifications } = fakePiContext(workingFolder, { hasUI: false })

  await pi.runCommand("memory-init", context)

  expect(prompts).toEqual([])
  expect(notifications).toEqual([])
  expect(await readFile(configPath, "utf8")).toBe(before)
})
