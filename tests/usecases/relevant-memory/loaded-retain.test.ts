import { expect, test } from "vitest"

import { LoadedMemory } from "#src/usecases"

function note(path: string, hash: string, dontForget: boolean) {
  return {
    kind: "read" as const,
    vault: "global" as const,
    path,
    id: "01JABCDE7XKQ2M9V3RTN8WPZ5F",
    hash,
    statement: path,
    body: "body",
    type: "rule" as const,
    dontForget,
  }
}

test("compaction keeps notes still retained in context and forgets removed ones so they can be loaded again", () => {
  const loaded = new LoadedMemory()
  loaded.remember(note("a.md", "h1", false))
  loaded.remember(note("b.md", "h2", false))
  loaded.remember(note("always.md", "h3", true))
  loaded.retain((item) => item.path === "b.md")
  expect(
    loaded
      .all()
      .map((item) => item.path)
      .sort(),
  ).toEqual(["always.md", "b.md"])
  expect(loaded.has(note("a.md", "h1", false))).toBe(false)
})
