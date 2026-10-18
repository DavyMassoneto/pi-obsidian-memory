import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { captureMemory, synchronizeMemory } from "#src/usecases"
import { captureFixture, noteWithId, putCatalogFile, scriptedCompletion, userSays } from "#test-helpers"

const existingDraft = {
  folder: "tools",
  statement: "Use pnpm",
  body: "Always pnpm, in CI too.",
  type: "rule",
  dontForget: false,
} as const

test("a review can walk the tree with list, read the note with get and update it", async () => {
  const { context, vault } = await captureFixture()
  await putCatalogFile(vault, "tools/Use pnpm.md", noteWithId(1, "Always pnpm.", []))
  await synchronizeMemory({ vault: "global" }, context)
  const seen: string[] = []
  const complete = scriptedCompletion([
    { action: "list", vault: "global", folder: "" },
    (input) => {
      const listing = input.observations.findLast((item) => item.kind === "listing")
      if (listing?.kind !== "listing") throw new Error("no listing observation")
      seen.push(...listing.folders)
      return { action: "list", vault: "global", folder: "tools" }
    },
    (input) => {
      const listing = input.observations.findLast((item) => item.kind === "listing")
      if (listing?.kind !== "listing") throw new Error("no listing observation")
      seen.push(...listing.notes.map((note) => note.path))
      return { action: "get", vault: "global", path: "tools/Use pnpm.md" }
    },
    (input) => {
      const read = input.observations.findLast((item) => item.kind === "read")
      if (read?.kind !== "read") throw new Error("no read observation")
      return {
        action: "update",
        vault: "global",
        path: read.path,
        id: read.id,
        expectedHash: read.hash,
        note: existingDraft,
      }
    },
    { action: "finish" },
  ])

  const result = await captureMemory({ messages: userSays("pnpm in CI too"), explicitSaves: [] }, context, complete)

  expect(seen).toEqual(["tools", "tools/Use pnpm.md"])
  expect(result).toMatchObject({ succeeded: true, output: { applied: [{ operation: "update", status: "applied" }] } })
  expect(await readFile(join(vault.path, "tools/Use pnpm.md"), "utf8")).toContain("in CI too")
})
