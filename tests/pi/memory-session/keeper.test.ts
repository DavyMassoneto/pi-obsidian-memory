import { expect, test } from "vitest"

import { MemorySessionKeeper } from "#src/pi"

const paths = { configPath: "config.json", indexPath: "index" }

test("a tool call has no operation context before a session started", () => {
  expect(new MemorySessionKeeper().currentOperation("work", paths, undefined)).toBeNull()
})

test("the cycle operation runs on its own branch of the session", () => {
  expect(new MemorySessionKeeper().cycleOperation("work", paths)).toBeNull()
})

test("a retrieval operation has no context before a session started", () => {
  expect(new MemorySessionKeeper().retrievalOperation("work", paths)).toBeNull()
})
