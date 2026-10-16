import { describe, expect, it } from "vitest"

import { fitBudget, type LoadedNote, loadedNoteBlock } from "#src/domain"

const alpha: LoadedNote = { vault: "global", path: "tools/Alpha.md", type: "rule", body: "alpha body" }
const beta: LoadedNote = { vault: "global", path: "tools/Beta.md", type: "rule", body: "beta body" }
const gamma: LoadedNote = { vault: "global", path: "tools/Gamma.md", type: "rule", body: "g" }

describe("fitBudget", () => {
  const alphaSize = loadedNoteBlock(alpha).length
  const betaSize = loadedNoteBlock(beta).length

  it("keeps every note that fits, in order", () => {
    expect(fitBudget([alpha, beta], alphaSize + betaSize)).toEqual([alpha, beta])
  })

  it("never cuts a note: a note over the remaining budget is left out whole", () => {
    expect(fitBudget([alpha, beta], alphaSize + betaSize - 1)).toEqual([alpha])
  })

  it("stops at the first note that does not fit, even if a later one would", () => {
    expect(fitBudget([alpha, beta, gamma], alphaSize + loadedNoteBlock(gamma).length)).toEqual([alpha])
  })

  it("keeps nothing when the first note exceeds the budget or the budget is 0", () => {
    expect(fitBudget([alpha], alphaSize - 1)).toEqual([])
    expect(fitBudget([alpha], 0)).toEqual([])
  })

  it("returns an empty list for no notes", () => {
    expect(fitBudget([], 1000)).toEqual([])
  })
})
