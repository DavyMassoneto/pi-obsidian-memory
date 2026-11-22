import { expect, test } from "vitest"

import { recordsOf } from "#src/pi"
import {
  CONSOLIDATION_META_TYPE,
  NOTE_WRITTEN_TYPE,
  OBSERVATIONS_TYPE,
  RECTIFIED_TYPE,
  RECTIFY_FAILED_TYPE,
  USER_WORDS_TYPE,
} from "#src/usecases"
import { customEntry } from "#test-helpers"

const ID = "2026-10-26T13:35:00"

test("an observations entry is read only in the shape every version writes: an entry carrying anything else in an observation is not an observations record", () => {
  const plain = {
    fromId: "u1",
    coversUpToId: "a1",
    observations: [{ id: ID, content: "User asked for CSV.", tokens: 5 }],
  }
  const extended = { ...plain, observations: [{ id: ID, content: "User asked for CSV.", tokens: 5, origin: "user" }] }

  expect(
    recordsOf([customEntry("o1", OBSERVATIONS_TYPE, plain), customEntry("o2", OBSERVATIONS_TYPE, extended)]),
  ).toEqual([
    { kind: "observations", id: "o1", data: plain },
    { kind: "other", id: "o2" },
  ])
})

test("a valid rectification entry becomes a rectified record, and an invalid one is ignored", () => {
  const data = {
    recordId: "o1",
    fromId: "a1",
    coversUpToId: "t1",
    userEntryIds: [],
    observations: [
      { id: ID, origin: "material" as const, content: "Session X's user said it.", sourceId: "t1", quote: "said it" },
      { id: `${ID}.01`, origin: "user" as const, supportedBy: "u0", quote: "Nunca" },
      { id: `${ID}.02`, origin: "mention" as const },
      { id: `${ID}.03`, origin: "partial" as const, supportedBy: "u0", quote: "Nunca", quotes: ["Nunca"] },
    ],
  }

  expect(
    recordsOf([
      customEntry("x1", RECTIFIED_TYPE, data),
      customEntry("x2", RECTIFIED_TYPE, { ...data, observations: [] }),
      customEntry("x3", RECTIFIED_TYPE, { recordId: "o1" }),
      customEntry("x4", RECTIFIED_TYPE, {
        ...data,
        observations: [{ id: ID, origin: "material" as const, content: "two\nlines" }],
      }),
    ]),
  ).toEqual([
    { kind: "rectified", id: "x1", data },
    { kind: "other", id: "x2" },
    { kind: "other", id: "x3" },
    { kind: "other", id: "x4" },
  ])
})

test("the companion entries of the cycle become their own records, and invalid ones are ignored", () => {
  const words = { entryId: "u1", passages: [{ kind: "restriction" as const, quote: "Nunca faça commit" }] }
  const meta = {
    observationIds: [],
    journey: "rewritten",
    materialIds: [ID],
    notes: [{ vault: "global" as const, path: "a/b.md" }],
  }
  const note = { observationIds: [ID], vault: "project" as const, path: "rules/Use pnpm.md" }
  const failed = { recordId: "o1", problem: "Model call unsupported" }

  expect(
    recordsOf([
      customEntry("w1", USER_WORDS_TYPE, words),
      customEntry("w2", USER_WORDS_TYPE, { entryId: "u1" }),
      customEntry("m1", CONSOLIDATION_META_TYPE, meta),
      customEntry("m2", CONSOLIDATION_META_TYPE, { journey: "x" }),
      customEntry("n1", NOTE_WRITTEN_TYPE, note),
      customEntry("n2", NOTE_WRITTEN_TYPE, { vault: "global" }),
      customEntry("f1", RECTIFY_FAILED_TYPE, failed),
      customEntry("f2", RECTIFY_FAILED_TYPE, { recordId: "" }),
    ]),
  ).toEqual([
    { kind: "user-words", id: "w1", data: words },
    { kind: "other", id: "w2" },
    { kind: "consolidation-meta", id: "m1", data: meta },
    { kind: "other", id: "m2" },
    { kind: "note-written", id: "n1", data: note },
    { kind: "other", id: "n2" },
    { kind: "rectify-failed", id: "f1", data: failed },
    { kind: "other", id: "f2" },
  ])
})
