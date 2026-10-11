import { expect, test } from "vitest"

import { maintenanceProblemsOf } from "#/usecases"
import { aNote } from "#test-helpers"

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
