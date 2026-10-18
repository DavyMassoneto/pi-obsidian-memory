import { expect, test } from "vitest"

import { comparablePath, isInside, resolveProject } from "#src/domain"
import { aConfig } from "#test-helpers"

test("tells apart folders that differ only in case on linux", () => {
  expect(isInside("/h/Vault/x", "/h/vault", "linux")).toBe(false)
  expect(isInside("/h/vault/x", "/h/vault", "linux")).toBe(true)
})

test("ignores case on darwin and win32", () => {
  expect(isInside("/h/Vault/x", "/h/vault", "darwin")).toBe(true)
  expect(isInside("C:/H/Vault/x", "c:/h/vault", "win32")).toBe(true)
})

test("keeps a backslash as part of the name on linux and darwin", () => {
  expect(comparablePath("/h/a\\b", "linux")).toBe("/h/a\\b")
  expect(comparablePath("/h/A\\b", "darwin")).toBe("/h/a\\b")
  expect(comparablePath("C:\\H\\A", "win32")).toBe("c:/h/a")
})

test("does not match a project that differs only in case on linux", () => {
  const config = { ...aConfig(), projects: [{ name: "api", folder: "/work/Api", vault: "/vaults/api" }] }

  expect(resolveProject(config, "/work/api/src", "linux")).toEqual({ succeeded: false })
  expect(resolveProject(config, "/work/Api/src", "linux")).toMatchObject({ succeeded: true, output: { name: "api" } })
  expect(resolveProject(config, "/work/api/src", "darwin")).toMatchObject({ succeeded: true, output: { name: "api" } })
})
