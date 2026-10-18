import { readFile, realpath } from "node:fs/promises"
import { basename, join } from "node:path"

import { expect, test } from "vitest"

import { renderVaultAssets } from "#src/domain"
import { INIT_DONE, INIT_NAME_TITLE, INIT_VAULT_TITLE } from "#src/pi"
import {
  configuredWorld,
  dialogsTitled,
  initVaultStep,
  nameStep,
  notifiedWith,
  onlyProject,
  rewriteConfig,
  runInit,
} from "#test-helpers"

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
