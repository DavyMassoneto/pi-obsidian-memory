import { mkdir, readdir } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { readNote } from "#src/services"
import { addMemory, maintenanceProblemsOf } from "#src/usecases"
import { aLimits, aNote, linkFolder, operationContextFor, setupVaults } from "#test-helpers"

const draft = {
  statement: "Use pnpm, never npm",
  type: "rule" as const,
  body: "Use pnpm everywhere.",
  dontForget: false,
}

test("reports a saved note and the true maintenance cause when the index points outside", async () => {
  const { root, globalVault, configPath, unregisteredFolder } = await setupVaults()
  const outside = join(root, "outside")
  await mkdir(outside)
  await linkFolder(outside, join(globalVault, "index.md"))

  const result = await addMemory(
    { scope: "global", folder: "pnpm", draft },
    operationContextFor({ configPath, workingFolder: unregisteredFolder }),
  )

  expect(result).toMatchObject({
    succeeded: true,
    output: { maintenanceProblems: ["outside-vault: index.md leads outside the vault"] },
  })
  expect(await readNote({ path: globalVault, limits: aLimits() }, "pnpm", draft.statement)).toMatchObject({
    succeeded: true,
  })
  expect(await readdir(outside)).toEqual([])
})

test("reports persistence when the index destination is a directory", async () => {
  const { globalVault, configPath, unregisteredFolder } = await setupVaults()
  await mkdir(join(globalVault, "index.md"))

  const result = await addMemory(
    { scope: "global", folder: "pnpm", draft },
    operationContextFor({ configPath, workingFolder: unregisteredFolder }),
  )

  expect(result).toMatchObject({
    succeeded: true,
    output: { maintenanceProblems: [expect.stringContaining("index.md")] },
  })
  expect(await readNote({ path: globalVault, limits: aLimits() }, "pnpm", draft.statement)).toMatchObject({
    succeeded: true,
  })
  expect(await readdir(join(globalVault, "index.md"))).toEqual([])
})

test("keeps an index refusal's true reason and every problem", () => {
  expect(
    maintenanceProblemsOf({
      succeeded: false,
      reason: "outside-vault",
      problems: ["index.md leads outside the vault", "root index was not refreshed"],
    }),
  ).toEqual(["outside-vault: index.md leads outside the vault", "outside-vault: root index was not refreshed"])
})

test("keeps successful publication cleanup warnings separate from note content", () => {
  const note = aNote()
  expect(
    maintenanceProblemsOf({
      succeeded: true,
      output: { note, hash: "hash" },
      maintenanceProblems: ["temporary file cleanup failed (EPERM)"],
    }),
  ).toEqual(["temporary file cleanup failed (EPERM)"])
  expect(note).toEqual(aNote())
})

test("keeps expected maintenance I/O failures diagnostic instead of inventing a write refusal", () => {
  expect(
    maintenanceProblemsOf({
      succeeded: false,
      reason: "io-error",
      problems: ["cannot inspect folder: EIO"],
    }),
  ).toEqual(["io-error: cannot inspect folder: EIO"])
})

test("successful maintenance without a warning stays quiet", () => {
  expect(maintenanceProblemsOf({ succeeded: true })).toEqual([])
})
