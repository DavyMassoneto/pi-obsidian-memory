import { join } from "node:path"

import { expect, test } from "vitest"

import { resolveRegistrationVault } from "#/services"
import { useTempFolder } from "#test-helpers"

test("registration vault paths resolve only against the supplied fully qualified working folder", async () => {
  const root = await useTempFolder()
  expect(resolveRegistrationVault({ vault: "../vault", workingFolder: join(root, "work") })).toEqual({
    succeeded: true,
    output: join(root, "vault"),
  })
  expect(resolveRegistrationVault({ vault: root, workingFolder: join(root, "work") })).toEqual({
    succeeded: true,
    output: root,
  })
  for (const vault of ["", "   ", "C:relative", "\\rooted"]) {
    expect(resolveRegistrationVault({ vault, workingFolder: root })).toMatchObject({ succeeded: false })
  }
  expect(resolveRegistrationVault({ vault: "vault", workingFolder: "relative" })).toMatchObject({ succeeded: false })
})

test.runIf(process.platform === "win32")("rooted Windows paths never inherit an ambient drive", async () => {
  const root = await useTempFolder()
  expect(resolveRegistrationVault({ vault: "/rooted", workingFolder: root })).toMatchObject({ succeeded: false })
  expect(resolveRegistrationVault({ vault: "vault", workingFolder: "/rooted" })).toMatchObject({ succeeded: false })
})
