import { describe, expect, it } from "vitest"

import {
  activeObservations,
  compactionObservations,
  ledgerOf,
  poolTokens,
  renderCompactionSummary,
  selectPromotion,
  wholeUserWords,
} from "#src/domain"
import {
  compactionRecord,
  consolidatedRecord,
  observation,
  observationsRecord,
  recordsWithThreeChunks,
  rectifiedRecord,
  unchecked,
  userRecord,
  userWordsRecord,
  withLocalTime,
} from "#test-helpers"

const early = observation("2026-10-26T13:35:00", "early")
const middleLater = observation("2026-10-26T13:50:00", "middle later")
const middleEarlier = observation("2026-10-26T13:40:00", "middle earlier")
const late = observation("2026-10-26T14:10:00", "late")

describe("compactionObservations", () => {
  it("only observations of chunks that end before the cut are kept, sorted by id", () => {
    const ledger = ledgerOf(recordsWithThreeChunks(early, middleLater, middleEarlier, late))

    expect(compactionObservations(ledger, 6)).toEqual(unchecked([early, middleEarlier, middleLater]))
    expect(compactionObservations(ledger, 3)).toEqual(unchecked([early]))
  })

  it("observations already consolidated are left out", () => {
    const ledger = {
      ...ledgerOf(recordsWithThreeChunks(early, middleLater, middleEarlier, late)),
      consolidated: new Set([early.id]),
    }

    expect(compactionObservations(ledger, 6)).toEqual(unchecked([middleEarlier, middleLater]))
  })

  it("a consolidated observation is not in the compaction block, whatever the position of its entry", () => {
    const records = recordsWithThreeChunks(early, middleLater, middleEarlier, late)

    for (const position of [0, 3, 6, records.length]) {
      const branch = records.toSpliced(position, 0, consolidatedRecord("c1", [early.id, middleLater.id], "journey"))

      expect(compactionObservations(ledgerOf(branch), branch.length)).toEqual(unchecked([middleEarlier, late]))
    }
  })

  it.each(["2026-10-26T13:35:00", "2026-10-26T13:34:59"])(
    "re-compaction retains consolidated user directives in source order, not in the pool (revision timestamp %s)",
    (revisionTime) => {
      const original = "Validate all export formats and make a backup."
      const correction = "Change of scope: validate only CSV and do not make a backup."
      const paraphrase = observation(early.id, "User authorized a backup and asked to validate all formats.")
      const observed = [
        userRecord("u0", original, 10),
        withLocalTime(userRecord("u1", correction, 10), revisionTime),
        observationsRecord("o1", "u0", "u1", [middleLater, paraphrase]),
        rectifiedRecord("x1", {
          recordId: "o1",
          fromId: "u0",
          coversUpToId: "u1",
          userEntryIds: ["u0", "u1"],
          observations: [{ id: paraphrase.id, origin: "user", supportedBy: "u0", quote: original }],
        }),
      ]
      const companions = wholeUserWords(observed)
        .reverse()
        .map((words) => userWordsRecord(`words-${words.entryId}`, words))
      const initial = [...observed, ...companions, userRecord("u2", "Check the new data.", 10)]
      const before = compactionObservations(ledgerOf(initial), initial.length - 1)
      const directives = before.filter((item) => typeof item.userEntryIndex === "number")
      expect(directives.map((item) => item.content)).toEqual([
        `User wrote (message): "${original}"`,
        `User wrote (message): "${correction}"`,
      ])

      const journey = "The session discussed export validation."
      const tombstones = before.map((item) => item.id)
      const records = [
        ...initial,
        compactionRecord("p1", "u2"),
        consolidatedRecord("c1", tombstones, journey),
        observationsRecord("o2", "u2", "u2", [late, middleEarlier]),
        userRecord("u3", "Continue.", 10),
      ]
      const ledger = ledgerOf(records)
      const observations = compactionObservations(ledger, records.length - 1)
      expect(observations).toEqual([...directives, ...unchecked([middleEarlier, late])])
      expect(activeObservations(ledger)).toEqual(unchecked([middleEarlier, late]))
      expect(poolTokens(ledger)).toBe(middleEarlier.tokens + late.tokens)
      expect(selectPromotion(ledger, late.tokens)).toEqual(unchecked([middleEarlier]))

      const summary = renderCompactionSummary({ journey: ledger.journey, map: "", observations, corrections: [] })
      expect(summary).toContain(`## Journey\n${journey}\n\n## Observations\n`)
      expect(summary).toContain(`User wrote (message): "${correction}"`)
    },
  )
})
