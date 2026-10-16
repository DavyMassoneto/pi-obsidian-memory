import { mkdir, readdir } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { addMemory, initProjectMemory, prepareProjectInit, setupMemory } from "#src/usecases"
import { registrationUsecaseFixture } from "#test-helpers"

const draft = {
  statement: "Use pnpm, never npm",
  type: "lesson" as const,
  body: "Use pnpm everywhere.",
  dontForget: false,
}

test("after setup and init a project memory from a subfolder lands in the project vault and an unregistered folder saves only globally", async () => {
  const { root, context, request, config } = await registrationUsecaseFixture()
  expect((await setupMemory(request, context)).succeeded).toBe(true)
  const preparation = await prepareProjectInit(context)
  if (!preparation.succeeded) throw new Error(preparation.problems.join("\n"))
  const projectVault = join(root, "loja-vault")
  const init = await initProjectMemory(
    { name: "loja", vault: projectVault, expectedHash: preparation.output.expectedHash },
    { ...context, stamp: context.session.stamp() },
  )
  expect(init.succeeded).toBe(true)
  const subfolder = join(context.workingFolder, "src", "api")
  await mkdir(subfolder, { recursive: true })
  const unregistered = join(root, "elsewhere")
  await mkdir(unregistered)

  const project = await addMemory(
    { scope: "project", folder: "tools", draft },
    { configPath: context.configPath, workingFolder: subfolder },
  )
  const refused = await addMemory(
    { scope: "project", folder: "tools", draft },
    { configPath: context.configPath, workingFolder: unregistered },
  )
  const global = await addMemory(
    { scope: "global", folder: "tools", draft },
    { configPath: context.configPath, workingFolder: unregistered },
  )

  expect(project).toMatchObject({ succeeded: true, output: { vaultName: "loja-vault" } })
  expect(await readdir(join(projectVault, "tools"))).toContain("Use pnpm, never npm.md")
  expect(refused).toMatchObject({ succeeded: false, reason: "no-project" })
  expect(global).toMatchObject({ succeeded: true })
  expect(await readdir(join(config.global.vault, "tools"))).toContain("Use pnpm, never npm.md")
})
