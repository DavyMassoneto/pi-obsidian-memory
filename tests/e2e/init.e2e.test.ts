import { mkdir, readdir, readFile, realpath, writeFile } from "node:fs/promises"
import { basename, join } from "node:path"

import { expect, test } from "vitest"

import { renderVaultAssets } from "#src/domain"
import {
  INIT_CANCELLED,
  INIT_DONE,
  INIT_NAME_TITLE,
  INIT_REPOINT_VAULT_TITLE,
  INIT_SETUP_HINT,
  INIT_VAULT_TITLE,
  UNREADABLE_CONFIG_NOTICE,
} from "#src/pi"
import {
  callsOf,
  configText,
  configuredWorld,
  dialogsTitled,
  e2eWorld,
  endOf,
  errorsOf,
  fileExists,
  initVaultStep,
  nameStep,
  nameStepEscape,
  noMemoryWorld,
  notifiedWith,
  notifySettles,
  onlyProject,
  pressEscape,
  rewriteConfig,
  runInit,
  storedConfig,
  toolCallPrompt,
  toolText,
} from "#test-helpers"

const bytes = Buffer.from([0, 255, 13, 10])

test("init registers the folder with the default name, creates the vault with templates and says so", async () => {
  const world = await configuredWorld({})
  await rewriteConfig(world, { projects: [] })
  const vault = join(world.folders.root, "Loja memory")
  const turn = await runInit(world, [nameStep(""), initVaultStep(INIT_VAULT_TITLE, vault)])
  const project = await onlyProject(world)
  expect(project.name).toBe(basename(world.folders.cwd))
  expect(await realpath(project.folder)).toBe(await realpath(world.folders.cwd))
  expect(await realpath(project.vault)).toBe(await realpath(vault))
  expect(dialogsTitled(world, INIT_NAME_TITLE)[0]?.placeholder).toBe(project.name)
  for (const asset of renderVaultAssets()) expect(await readFile(join(vault, asset.path), "utf8")).toBe(asset.content)
  expect(turn.notifications.map((notice) => notice.notifyType)).toEqual(["info"])
  expect(notifiedWith(turn, `${INIT_DONE} ${project.name}`)).toHaveLength(1)
  expect(world.pi.unexpected).toEqual([])
})

test("memory_add from a subfolder of a registered folder saves into that project's vault", async () => {
  const world = await configuredWorld({ startIn: "subfolder" })
  const registered = { name: "Loja", folder: world.folders.cwd, vault: world.folders.projectVault }
  await rewriteConfig(world, { projects: [registered] })
  await world.restart()
  const add = {
    scope: "project",
    folder: "tools",
    statement: "Use pnpm",
    type: "lesson",
    body: "Always.",
    dontForget: false,
  }
  const added = await world.pi.prompt(toolCallPrompt("memory_add", JSON.stringify(add)), [])
  expect(callsOf(added, "memory_add")).toBe(1)
  expect(toolText(endOf(added, "memory_add"))).toBe(`Saved in ${basename(registered.vault)}: tools/Use pnpm.md`)
  expect(await fileExists(join(world.folders.projectVault, "tools", "Use pnpm.md"))).toBe(true)
})

test("a taken name, in any case, is refused and asked again", async () => {
  const world = await configuredWorld({})
  const other = {
    name: "Shop",
    folder: join(world.folders.root, "shop"),
    vault: join(world.folders.root, "shop-vault"),
  }
  await rewriteConfig(world, { projects: [other] })
  const vault = join(world.folders.root, "Loja memory")
  const turn = await runInit(world, [nameStep("SHOP"), nameStep("Loja"), initVaultStep(INIT_VAULT_TITLE, vault)])
  expect(turn.notifications.map((notice) => notice.notifyType)).toEqual(["error", "info"])
  expect(errorsOf(turn)[0]).toContain("SHOP")
  expect(dialogsTitled(world, INIT_NAME_TITLE)).toHaveLength(2)
  const { projects } = await storedConfig(world)
  expect(projects.map((project) => project.name)).toEqual(["Shop", "Loja"])
  expect(world.pi.unexpected).toEqual([])
})

test("in a registered folder, started from a subfolder, only the vault is asked, the name is kept and the old vault is untouched", async () => {
  const world = await configuredWorld({ startIn: "subfolder" })
  const oldVault = join(world.folders.root, "old-vault")
  await mkdir(oldVault)
  await writeFile(join(oldVault, "keep.md"), bytes)
  const registered = { name: "Loja Shop", folder: world.folders.cwd, vault: oldVault }
  await rewriteConfig(world, { projects: [registered] })
  const newVault = join(world.folders.root, "new-vault")
  await runInit(world, [initVaultStep(INIT_REPOINT_VAULT_TITLE, newVault)])
  expect(dialogsTitled(world, INIT_NAME_TITLE)).toEqual([])
  const project = await onlyProject(world)
  expect(project.name).toBe("Loja Shop")
  expect(await realpath(project.vault)).toBe(await realpath(newVault))
  expect(await readdir(oldVault)).toEqual(["keep.md"])
  expect(await readFile(join(oldVault, "keep.md"))).toEqual(bytes)
  expect(await readdir(newVault)).toContain("_templates")
  expect(world.pi.unexpected).toEqual([])
})

test("an invalid config refuses init with every problem and offers /memory-setup", async () => {
  const world = await configuredWorld({})
  const text = JSON.stringify({ ...(await storedConfig(world)), limits: { maxBodyChars: -1 } })
  await writeFile(world.folders.configPath, text)
  const turn = await runInit(world, [])
  expect(turn.notifications).toHaveLength(1)
  for (const expected of ["maxBodyChars", "maxStatementChars", INIT_SETUP_HINT])
    expect(errorsOf(turn)[0]).toContain(expected)
  expect(await configText(world)).toBe(text)
  expect(world.pi.unexpected).toEqual([])
})

test.each([
  { question: "the name", steps: [nameStepEscape()] },
  {
    question: "the vault",
    steps: [nameStep(""), { method: "input", title: INIT_VAULT_TITLE, answer: pressEscape } as const],
  },
])("cancelling at $question writes nothing", async ({ steps }) => {
  const world = await configuredWorld({})
  await rewriteConfig(world, { projects: [] })
  const text = await configText(world)
  const before = await readdir(world.folders.root)
  const turn = await runInit(world, steps)
  expect(turn.notifications.map((notice) => notice.message)).toEqual([INIT_CANCELLED])
  expect(await configText(world)).toBe(text)
  expect(await readdir(world.folders.root)).toEqual(before)
  expect(world.pi.unexpected).toEqual([])
})

test("a vault nested inside another registered vault is refused and the config stays as it was", async () => {
  const world = await configuredWorld({})
  await rewriteConfig(world, { projects: [] })
  const text = await configText(world)
  const turn = await runInit(world, [
    nameStep(""),
    initVaultStep(INIT_VAULT_TITLE, join(world.folders.globalVault, "inner")),
  ])
  expect(turn.notifications).toHaveLength(1)
  expect(errorsOf(turn)[0]).toContain("vaults must not be equal or nested")
  expect(await configText(world)).toBe(text)
  expect(world.pi.unexpected).toEqual([])
})

test("an unreadable config refuses init with its problem and does not offer /memory-setup", async () => {
  const world = await e2eWorld({ memory: "none", tools: [], modelCache: "fresh", capture: "after-each-turn" })
  await mkdir(world.folders.configPath, { recursive: true })
  await world.restart()
  await world.pi.waitFor(notifySettles([UNREADABLE_CONFIG_NOTICE]), 0)
  const turn = await runInit(world, [])
  expect(turn.notifications).toHaveLength(1)
  expect(errorsOf(turn)[0]).toContain(world.folders.configPath)
  expect(errorsOf(turn)[0]).not.toContain(INIT_SETUP_HINT)
  expect(world.pi.unexpected).toEqual([])
})

test("with no config init refuses before it asks anything and offers /memory-setup", async () => {
  const world = await noMemoryWorld({ modelCache: "fresh" })
  const turn = await runInit(world, [])
  expect(turn.notifications).toHaveLength(1)
  expect(errorsOf(turn)[0]).toContain(INIT_SETUP_HINT)
  expect(world.pi.unexpected).toEqual([])
})
