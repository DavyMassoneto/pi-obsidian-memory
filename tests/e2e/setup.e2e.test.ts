import { mkdir, readFile, realpath, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"

import { expect, test } from "vitest"

import { renderVaultAssets } from "#src/domain"
import {
  DONE_LABEL,
  INIT_SETUP_HINT,
  INVALID_CONFIG_NOTICE,
  MEMORY_INIT_COMMAND,
  MEMORY_SETUP_COMMAND,
  NO_MEMORY_NOTICE,
  REPAIR_HINT,
  REPAIR_TITLE,
  SAVED,
  SETTINGS_TITLE,
  SETUP_AGENT_MODEL_TITLE,
  SETUP_ATTACH_OPTION,
  SETUP_CANCELLED,
  SETUP_CAPTURE_MODEL_TITLE,
  SETUP_DONE,
  SETUP_MODE_TITLE,
  SETUP_VAULT_TITLE,
  WHEN_TITLE,
} from "#src/pi"
import { readConfig } from "#src/services"
import {
  dialogTitled,
  E2E_MODEL,
  E2E_PROJECT_NAME,
  E2E_PROVIDER,
  e2eWorld,
  fileExists,
  NotifySchema,
  notifiedWith,
  notifySettles,
  nth,
  recordOf,
} from "#test-helpers"

const model = `${E2E_PROVIDER}/${E2E_MODEL}`

test("with no config, pi tells the user to run /memory-setup, and /memory-init refuses until setup", async () => {
  const world = await e2eWorld({ memory: "none", tools: [], modelCache: "fresh", capture: "after-each-turn" })
  const notice = recordOf(NotifySchema, await world.pi.waitFor(notifySettles([NO_MEMORY_NOTICE]), 0))
  expect(notice?.message).toBe(NO_MEMORY_NOTICE)
  expect(notice?.notifyType).toBe("info")
  const init = await world.pi.command(`/${MEMORY_INIT_COMMAND}`, [], notifySettles([]))
  expect(init.notifications.map((notice) => notice.message).join("\n")).toContain(INIT_SETUP_HINT)
  expect(await fileExists(world.folders.configPath)).toBe(false)
  expect(world.pi.unexpected).toEqual([])
})

test("first /memory-setup and /memory-init write every key, the templates and the dashboards", async () => {
  const world = await e2eWorld({ memory: "configured", tools: [], modelCache: "shared", capture: "after-each-turn" })
  const { globalVault, projectVault, cwd } = world.folders
  const config = await readConfig(world.folders.configPath)
  if (!config.succeeded) throw new Error(config.problems.join("\n"))
  const saved = config.output
  const [project] = saved.projects
  if (!project) throw new Error("no project")
  expect(await realpath(saved.global.vault)).toBe(await realpath(globalVault))
  expect(saved.projects).toHaveLength(1)
  expect(project.name).toBe(E2E_PROJECT_NAME)
  expect(await realpath(project.folder)).toBe(await realpath(cwd))
  expect(await realpath(project.vault)).toBe(await realpath(projectVault))
  expect(saved.capture).toEqual({ model: { provider: E2E_PROVIDER, id: E2E_MODEL }, when: "after-each-turn" })
  expect(saved.memoryAgent).toEqual({ model: { provider: E2E_PROVIDER, id: E2E_MODEL } })
  expect(saved.decisionModel).toEqual({ provider: "typesafe", model: "jev-latest" })
  expect(saved.embeddings).toEqual({ provider: "local", model: "Xenova/multilingual-e5-small" })
  for (const vault of [globalVault, projectVault]) {
    for (const asset of renderVaultAssets()) {
      expect(await readFile(join(vault, asset.path), "utf8")).toBe(asset.content)
    }
  }
})

test("the settings screen changes when capture runs and saves it", async () => {
  const world = await e2eWorld({ memory: "configured", tools: [], modelCache: "shared", capture: "after-each-turn" })
  const turn = await world.pi.command(
    `/${MEMORY_SETUP_COMMAND}`,
    [
      { method: "select", title: SETTINGS_TITLE, answer: { option: "Capture runs:" } },
      { method: "select", title: WHEN_TITLE, answer: { option: "on compaction" } },
      { method: "select", title: SETTINGS_TITLE, answer: { value: DONE_LABEL } },
    ],
    nth(dialogTitled(SETTINGS_TITLE), 2),
  )
  expect(notifiedWith(turn, SAVED)).toHaveLength(1)
  const config = await readConfig(world.folders.configPath)
  if (!config.succeeded) throw new Error(config.problems.join("\n"))
  expect(config.output.capture.when).toBe("on-compaction")
  expect(world.pi.unexpected).toEqual([])
})

test("an invalid config turns memory off with a notice, and /memory-setup repairs it after confirmation", async () => {
  const world = await e2eWorld({ memory: "none", tools: [], modelCache: "fresh", capture: "after-each-turn" })
  await mkdir(dirname(world.folders.configPath), { recursive: true })
  await writeFile(world.folders.configPath, "{ not json")
  await world.restart()
  const notice = recordOf(NotifySchema, await world.pi.waitFor(notifySettles([INVALID_CONFIG_NOTICE]), 0))
  expect(notice?.message.startsWith(INVALID_CONFIG_NOTICE)).toBe(true)
  expect(notice?.message.endsWith(REPAIR_HINT)).toBe(true)
  expect(notice?.notifyType).toBe("warning")
  const turn = await world.pi.command(
    `/${MEMORY_SETUP_COMMAND}`,
    [
      { method: "confirm", title: REPAIR_TITLE, answer: { confirmed: true } },
      { method: "select", title: SETUP_CAPTURE_MODEL_TITLE, answer: { option: model } },
      { method: "select", title: SETUP_AGENT_MODEL_TITLE, answer: { option: model } },
      { method: "select", title: SETUP_MODE_TITLE, answer: { option: SETUP_ATTACH_OPTION } },
      { method: "input", title: SETUP_VAULT_TITLE, answer: { value: world.folders.globalVault } },
    ],
    notifySettles([SETUP_DONE, SETUP_CANCELLED]),
  )
  expect(notifiedWith(turn, SETUP_DONE)).toHaveLength(1)
  const config = await readConfig(world.folders.configPath)
  if (!config.succeeded) throw new Error(config.problems.join("\n"))
  expect(await realpath(config.output.global.vault)).toBe(await realpath(world.folders.globalVault))
  expect(config.output.capture).toEqual({
    model: { provider: E2E_PROVIDER, id: E2E_MODEL },
    when: "after-each-turn",
  })
  expect(config.output.memoryAgent).toEqual({ model: { provider: E2E_PROVIDER, id: E2E_MODEL } })
  expect(world.pi.unexpected).toEqual([])
})
