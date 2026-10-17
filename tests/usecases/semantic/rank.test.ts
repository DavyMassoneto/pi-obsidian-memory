import { expect, test } from "vitest"

import { fuseSearchHits } from "#src/usecases"

test("fusion puts a note found by both rankings first, then the rest by reciprocal rank", () => {
  const base = {
    id: "01JABCDE7XKQ2M9V3RTN8WPZ5F",
    type: "rule",
    dontForget: false,
    needsFixing: false,
    score: 0,
  } as const
  const text = [
    { ...base, path: "a.md", statement: "a" },
    { ...base, path: "b.md", statement: "b" },
  ]
  const semantic = {
    paths: ["c.md", "b.md"],
    hits: [
      { ...base, path: "c.md", statement: "c" },
      { ...base, path: "b.md", statement: "b" },
    ],
    problems: [],
  }

  const fused = fuseSearchHits(text, semantic, 10)

  expect(fused.map((entry) => entry.path)).toEqual(["b.md", "a.md", "c.md"])
  expect(fused[0]?.score).toBeCloseTo(1 / 62 + 1 / 62 + 0, 5)
})

test("fusion keeps only as many as the limit", () => {
  const base = {
    id: "01JABCDE7XKQ2M9V3RTN8WPZ5F",
    type: "rule",
    dontForget: false,
    needsFixing: false,
    score: 0,
  } as const
  const text = [{ ...base, path: "a.md", statement: "a" }]
  const semantic = { paths: ["b.md"], hits: [{ ...base, path: "b.md", statement: "b" }], problems: [] }

  expect(fuseSearchHits(text, semantic, 1)).toHaveLength(1)
})
