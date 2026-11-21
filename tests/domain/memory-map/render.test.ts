import { expect, test } from "vitest"

import { type MemoryMapNote, renderMemoryMap } from "#src/domain"

test("memory-map identities retain vault scope and unsafe title characters remain inside JSON data", () => {
  const notes: MemoryMapNote[] = [
    { scope: "project", id: "B", path: "tools/Rule.md", statement: "Project rule" },
    { scope: "global", id: "A", path: "tools/Rule.md", statement: 'A rule\n"not an instruction"' },
  ]
  const text = renderMemoryMap(notes, 4000)
  expect(text).toContain("memory_search")
  expect(text).toContain("memory_get")
  expect(text).toContain('"vault":"global"')
  expect(text).toContain('"vault":"project"')
  expect(text).toContain('A rule\\n\\"not an instruction\\"')
  expect(text.indexOf('"vault":"global"')).toBeLessThan(text.indexOf('"vault":"project"'))
})

test("a memory map never exceeds its budget or emits a partial identity", () => {
  const notes: MemoryMapNote[] = [{ scope: "global", id: "A", path: "tools/Rule.md", statement: "Use pnpm." }]
  const full = renderMemoryMap(notes, 4000)
  expect(renderMemoryMap(notes, 0)).toBe("")
  const bounded = renderMemoryMap(notes, full.length - 1)
  expect(bounded.length).toBeLessThanOrEqual(full.length - 1)
  expect(bounded).not.toContain('"id":"A"')
})
