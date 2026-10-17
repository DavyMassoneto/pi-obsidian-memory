import { expect, test } from "vitest"

import { unregisteredMentions } from "#test-helpers"

test("backticked and parenthesised mentions are caught too", () => {
  const registered = ["memory_add", "/memory-setup"]

  expect(unregisteredMentions(["Run `/memory-setup`, then `memory_add`."], registered)).toEqual([])
  expect(unregisteredMentions(["Run `/memory-doktor` (or (/memory-init)) or `memory_updat`."], registered)).toEqual([
    "/memory-doktor",
    "/memory-init",
    "memory_updat",
  ])
})

test("a registered slash command mention is accepted and an unregistered one is reported", () => {
  const registered = ["memory_add", "/memory-setup"]

  expect(unregisteredMentions(["Run /memory-setup, then memory_add."], registered)).toEqual([])
  expect(unregisteredMentions(["Run /memory-init or memory_update."], registered)).toEqual([
    "/memory-init",
    "memory_update",
  ])
})
