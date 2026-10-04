import { expect, test } from "vitest"

import { vaultNameOf } from "#/domain/config"

test.each([
  ["a forward-slash path", "C:/Users/Administrator/OneDrive/Obisidian/Global memory", "Global memory"],
  ["a Windows path", "C:\\vaults\\loja", "loja"],
  ["a path with a trailing separator", "C:/vaults/loja/", "loja"],
])("names the vault after its folder, for %s", (_case, path, name) => {
  expect(vaultNameOf(path)).toBe(name)
})
