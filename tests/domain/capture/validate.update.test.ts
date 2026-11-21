import { expect, test } from "vitest"

import { parseCaptureAction } from "#src/domain"
import { captureRequest, memoryDraft, readObservation } from "#test-helpers"

test.each(["MD", "mD", "Md"])("updates an exact read receipt with a %s extension unchanged", (extension) => {
  const read = { ...readObservation(), path: `profile/Access token.${extension}` }
  const input = { ...captureRequest(), observations: [read] }
  const action = {
    action: "update",
    vault: read.vault,
    path: read.path,
    id: read.id,
    expectedHash: read.hash,
    note: memoryDraft(),
  }
  expect(parseCaptureAction(JSON.stringify(action), input)).toEqual({ succeeded: true, output: action })
})

test("uppercase updates retain exact basename, folder, extension identity and latest hash guards", () => {
  const read = { ...readObservation(), path: "profile/Access token.MD" }
  const input = { ...captureRequest(), observations: [read] }
  const action = {
    action: "update",
    vault: read.vault,
    path: read.path,
    id: read.id,
    expectedHash: read.hash,
    note: memoryDraft(),
  }
  for (const changed of [
    { ...action, path: "profile/Access token.md" },
    { ...action, path: "Profile/Access token.MD" },
    { ...action, path: "profile/access token.MD" },
    { ...action, note: { ...action.note, statement: "access token" } },
    { ...action, note: { ...action.note, folder: "Profile" } },
    { ...action, note: { ...action.note, folder: "other" } },
    { ...action, expectedHash: "b".repeat(64) },
  ]) {
    expect(parseCaptureAction(JSON.stringify(changed), input).succeeded).toBe(false)
  }
  const newer = { ...read, hash: "b".repeat(64) }
  expect(parseCaptureAction(JSON.stringify(action), { ...input, observations: [read, newer] }).succeeded).toBe(false)
  const notMarkdown = { ...read, path: "profile/Access token.txt" }
  expect(
    parseCaptureAction(JSON.stringify({ ...action, path: notMarkdown.path }), { ...input, observations: [notMarkdown] })
      .succeeded,
  ).toBe(false)
})
