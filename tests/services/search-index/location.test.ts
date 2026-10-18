import { join } from "node:path"

import { expect, test } from "vitest"

import { indexFileFor } from "#src/services"

test("gives the same vault the same index file, however its path is written", () => {
  const folder = join("C:", "agent", "index")

  expect(indexFileFor(folder, "C:/Vaults/Global memory", "win32")).toBe(
    indexFileFor(folder, "c:\\vaults\\GLOBAL MEMORY\\", "win32"),
  )
})

test("gives different vaults different index files", () => {
  const folder = join("C:", "agent", "index")

  expect(indexFileFor(folder, "C:/Vaults/loja", "win32")).not.toBe(
    indexFileFor(folder, "C:/Vaults/loja-admin", "win32"),
  )
  expect(indexFileFor(folder, "C:/Vaults/loja", "win32")).toMatch(/[\\/]index[\\/][0-9a-f]{16}\.sqlite$/)
})

test("keeps the index file name Windows users already have", () => {
  expect(indexFileFor("index", "C:/Vaults/Global memory", "win32")).toBe(join("index", "dee5d6d4d19dede0.sqlite"))
})

test("gives vaults that differ only in case different index files on linux", () => {
  expect(indexFileFor("index", "/v/Memory", "linux")).not.toBe(indexFileFor("index", "/v/memory", "linux"))
  expect(indexFileFor("index", "/v/Memory", "darwin")).toBe(indexFileFor("index", "/v/memory", "darwin"))
})
