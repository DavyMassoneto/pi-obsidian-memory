import { describe, expect, it } from "vitest"

import {
  awaitsVerification,
  captureMaterial,
  journeyMaterial,
  type LedgerObservation,
  ORIGIN_MARKS,
  presentedContent,
} from "#src/domain"
import { observation, withOrigin } from "#test-helpers"

const repaired: LedgerObservation = {
  ...observation("2026-10-26T13:36:30", "Another session's transcript records an approval to deploy."),
  origin: "material",
  sources: ["t1"],
}

describe("presentedContent", () => {
  const said = observation("2026-10-26T13:35:00", "User said to put the bot in production.")

  it("a statement the user did not make, still in its original wording, is shown under its mark", () => {
    expect(presentedContent(withOrigin(said, "material"))).toBe(`${ORIGIN_MARKS.material} ${said.content}`)
  })

  it("an observation not checked yet is shown under its mark, whatever it says", () => {
    expect(ORIGIN_MARKS.unverified).toBe("[origin unverified]")
    expect(presentedContent(withOrigin(said, "unverified"))).toBe(`${ORIGIN_MARKS.unverified} ${said.content}`)
  })

  it("what the user said earlier in the session, re-read later, is shown as earlier speech", () => {
    const earlier: LedgerObservation = { ...said, origin: "restated", sources: ["u0"] }

    expect(presentedContent(earlier)).toBe(`${ORIGIN_MARKS.restated} ${said.content}`)
    expect(captureMaterial([earlier])).toEqual([{ label: said.id, text: `${ORIGIN_MARKS.restated} ${said.content}` }])
  })

  it("a statement only partly the user's shows first the words the user really wrote, verbatim, and then the recorded wording under the unconfirmed mark; durable notes receive only the user's words", () => {
    const partial: LedgerObservation = {
      ...said,
      origin: "partial",
      sources: ["u1"],
      userWords: ["ponha o bot", "hoje"],
    }
    const shown = `User wrote: "ponha o bot" [...] "hoje". ${ORIGIN_MARKS.unconfirmed} ${said.content}`

    expect(presentedContent(partial)).toBe(shown)
    expect(journeyMaterial([partial])).toEqual([{ label: said.id, text: shown }])
    expect(captureMaterial([partial])).toEqual([{ label: said.id, text: 'User wrote: "ponha o bot" [...] "hoje".' }])
  })

  it("an attribution that was checked and could not be confirmed is shown under its own mark", () => {
    expect(presentedContent(withOrigin(said, "unconfirmed"))).toBe(`${ORIGIN_MARKS.unconfirmed} ${said.content}`)
  })

  it("a rewritten statement keeps the non-user mark when its source is known", () => {
    expect(presentedContent(repaired)).toBe(`[not said by the user] ${repaired.content}`)
  })

  it("what the user said, a mention and the rest are shown as they are", () => {
    expect(presentedContent({ ...said, origin: "user", sources: ["u1"] })).toBe(said.content)
    expect(presentedContent(withOrigin(said, "mention"))).toBe(said.content)
    expect(presentedContent(observation("2026-10-26T13:35:00", "Build passed."))).toBe("Build passed.")
  })
})

describe("material for the consolidator", () => {
  const real = withOrigin(observation("2026-10-26T13:35:00", "User stated CSV files use a semicolon."), "user")
  const read = withOrigin(observation("2026-10-26T13:36:00", "User ordered a deploy."), "material")
  const open = withOrigin(observation("2026-10-26T13:37:00", "User prefers pnpm."), "unverified")
  const named = withOrigin(
    observation("2026-10-26T13:37:30", "Test prompt p1.txt has the user ask for a deploy."),
    "mention",
  )
  const plain = observation("2026-10-26T13:38:00", "Build passed.")
  const doubt = withOrigin(observation("2026-10-26T13:39:00", "User wants weekly reports."), "unconfirmed")

  it("the journey receives every observation, each as presented", () => {
    expect(journeyMaterial([real, read, repaired, open, named, plain])).toEqual([
      { label: real.id, text: real.content },
      { label: read.id, text: `${ORIGIN_MARKS.material} ${read.content}` },
      { label: repaired.id, text: `[not said by the user] ${repaired.content}` },
      { label: open.id, text: `${ORIGIN_MARKS.unverified} ${open.content}` },
      { label: named.id, text: named.content },
      { label: plain.id, text: plain.content },
    ])
  })

  it("durable notes never receive what the user did not say or what is unverified", () => {
    expect(captureMaterial([real, read, repaired, open, named, plain])).toEqual([
      { label: real.id, text: real.content },
      { label: named.id, text: named.content },
      { label: plain.id, text: plain.content },
    ])
  })

  it("an unconfirmed attribution reaches the journey under its mark and never reaches durable notes", () => {
    expect(journeyMaterial([doubt])).toEqual([
      { label: doubt.id, text: `${ORIGIN_MARKS.unconfirmed} ${doubt.content}` },
    ])
    expect(captureMaterial([doubt, plain])).toEqual([{ label: plain.id, text: plain.content }])
  })

  it("a batch with an unverified mention waits for the verification", () => {
    expect(awaitsVerification([real, read, plain, doubt])).toBe(false)
    expect(awaitsVerification([real, open])).toBe(true)
  })
})
