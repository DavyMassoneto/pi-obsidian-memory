import { expect, test } from "vitest"

import { type AppliedWrite, changedNotes, writtenNote } from "#src/usecases"

function write(operation: AppliedWrite["operation"], status: AppliedWrite["status"], path: string): AppliedWrite {
  return { operation, status, vault: "global", path, detail: "" }
}

test("the notes a batch changed are the ones written or updated, once each; refused, conflicting and archived writes leave no note to trace", () => {
  const applied = [
    write("add", "applied", "rules/Never commit.md"),
    write("update", "applied", "rules/Never commit.md"),
    write("succeed", "applied", "rules/Use pnpm.md"),
    write("add", "refused", "rules/Refused.md"),
    write("update", "conflict", "rules/Conflict.md"),
    write("archive", "applied", "rules/Old.md"),
  ]

  expect(changedNotes(applied, [])).toEqual([
    { vault: "global", path: "rules/Never commit.md" },
    { vault: "global", path: "rules/Use pnpm.md" },
  ])
})

test("notes a batch wrote before it was interrupted are listed with the ones the run that finished it changed, once each, unless that run archived them", () => {
  const owed = [
    { vault: "global" as const, path: "rules/Written before.md" },
    { vault: "global" as const, path: "rules/Never commit.md" },
    { vault: "global" as const, path: "rules/Old.md" },
  ]
  const applied = [write("update", "applied", "rules/Never commit.md"), write("archive", "applied", "rules/Old.md")]

  expect(changedNotes(applied, owed)).toEqual([
    { vault: "global", path: "rules/Written before.md" },
    { vault: "global", path: "rules/Never commit.md" },
  ])

  expect(writtenNote(write("add", "applied", "a.md"))).toEqual({ vault: "global", path: "a.md" })
  expect(writtenNote(write("archive", "applied", "a.md"))).toBeNull()
  expect(writtenNote(write("add", "refused", "a.md"))).toBeNull()
})
