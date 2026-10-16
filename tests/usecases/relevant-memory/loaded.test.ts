import { expect, test } from "vitest"

import { LoadedMemory } from "#src/usecases"
import { readNote } from "#test-helpers"

test("a remembered note is found by its path and its hash", () => {
  const loaded = new LoadedMemory()
  loaded.remember(readNote("tools/Use pnpm.md", "a"))

  expect(loaded.has(readNote("tools/Use pnpm.md", "a"))).toBe(true)
  expect(loaded.has(readNote("tools/Use pnpm.md", "b"))).toBe(false)
  expect(loaded.has(readNote("tools/Other.md", "a"))).toBe(false)
})

test("remembering a path again replaces its copy, and forgetting drops it", () => {
  const loaded = new LoadedMemory()
  loaded.remember(readNote("tools/Use pnpm.md", "a"))
  loaded.remember(readNote("tools/Use pnpm.md", "b"))

  expect(loaded.all().map((note) => note.hash)).toEqual(["b".repeat(64)])
  loaded.forget(readNote("tools/Use pnpm.md", "b"))
  expect(loaded.all()).toEqual([])
})

test("applying changes forgets the dropped notes and remembers the loaded ones", () => {
  const loaded = new LoadedMemory()
  loaded.remember(readNote("tools/Old.md", "a"))
  loaded.remember(readNote("tools/Edited.md", "a"))

  loaded.apply({
    loaded: [readNote("tools/Edited.md", "b"), readNote("tools/New.md", "c")],
    forgotten: [readNote("tools/Old.md", "a")],
  })

  expect(loaded.all().map((note) => [note.path, note.hash.slice(0, 1)])).toEqual([
    ["tools/Edited.md", "b"],
    ["tools/New.md", "c"],
  ])
})
