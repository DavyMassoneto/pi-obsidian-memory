import { expect, test } from "vitest"

import {
  attributionChecks,
  captureMaterial,
  ledgerOf,
  materialSources,
  ORIGIN_MARKS,
  presentedContent,
  rectifiedData,
  repairedObservations,
  verifiedOrigins,
} from "#src/domain"
import { assistantRecord, observation, observationsRecord, rectifiedRecord, userRecord, verdict } from "#test-helpers"

const USER_REQUEST = "Send the report again."
const ASSISTANT_REASON = "The draft is blocked on a mandatory editorial review."
const ASSISTANT_DRAFT = "Editors must use the amber heading."

const draft = observation("2026-11-01T08:00:00", "The new standing rule for editors is to use the amber heading.")
const mixed = observation(
  "2026-11-01T08:00:01",
  "User asked to resend the report because editorial review was mandatory.",
)
const pure = observation("2026-11-01T08:00:02", "User requested another copy of the report.")
const neutral = observation("2026-11-01T08:00:03", "Assistant drafted an example for the user.")

const records = [
  assistantRecord("earlier", "An earlier draft outside the range.", 10),
  userRecord("user", USER_REQUEST, 5),
  assistantRecord("assistant", `${ASSISTANT_DRAFT}\n${ASSISTANT_REASON}`, 22),
  observationsRecord("observed", "user", "assistant", [draft, mixed, pure, neutral]),
  assistantRecord("later", "A later draft outside the range.", 10),
]

function check() {
  const [result] = attributionChecks(records, 100)
  if (!result) throw new Error("observation range not found")
  return result
}

test("attribution can see the capped original assistant block with its role and ID, not another interval's assistant statements", () => {
  const [clipped] = attributionChecks(records, ASSISTANT_DRAFT.length)
  expect(clipped).toMatchObject({
    userEntryIds: ["user"],
    userMessages: [{ id: "user", text: USER_REQUEST }],
    materialSources: [{ id: "assistant", role: "assistant", text: ASSISTANT_DRAFT, truncated: true }],
  })
})

test("assistant-authored direction goes to repair, but a neutral activity mentioning the user stays neutral", () => {
  const result = verifiedOrigins(check(), [verdict(draft.id, { actor: "assistant" }), verdict(neutral.id, {})])
  expect(result).toMatchObject({
    output: [{ id: draft.id, origin: "material" }, {}, {}, { id: neutral.id, origin: "mention" }],
  })
})

test("a same-topic exact user quote cannot give user ownership to an assistant verdict", () => {
  const result = verifiedOrigins(check(), [
    verdict(draft.id, { actor: "assistant", supportedBy: "user", quote: USER_REQUEST }),
  ])
  expect(result).toMatchObject({ output: [{ id: draft.id, origin: "unconfirmed" }, {}, {}, {}] })
})

test("conflicting verdicts for the same observation do not settle its authorship", () => {
  const result = verifiedOrigins(check(), [
    verdict(draft.id, { actor: "user", supportedBy: "user", quote: USER_REQUEST }),
    verdict(draft.id, { actor: "assistant" }),
  ])
  expect(result).toMatchObject({ output: [{ id: draft.id, origin: "unconfirmed" }, {}, {}, {}] })
})

test("literal overlap does not convert a draft or quotation into attribution to the user", () => {
  const quoted = observation("2026-11-01T08:00:04", 'Assistant read a script containing "Send the report again."')
  const input = { ...check(), observations: [quoted] }
  expect(verifiedOrigins(input, [verdict(quoted.id, { actor: "other" })])).toEqual({
    succeeded: true,
    output: [{ id: quoted.id, origin: "material" }],
  })
})

test("an earlier citation is not rebound to another message just because it contains the same words", () => {
  const input = {
    ...check(),
    userMessages: [{ id: "earlier-user", text: USER_REQUEST }, ...check().userMessages],
    observations: [pure],
  }
  expect(
    verifiedOrigins(input, [verdict(pure.id, { actor: "user", supportedBy: "earlier-user", quote: USER_REQUEST })]),
  ).toEqual({
    succeeded: true,
    output: [{ id: pure.id, origin: "restated", supportedBy: "earlier-user", quote: USER_REQUEST }],
  })
})

test("partial ownership keeps only the exact user quote promotable, not the mixed claim", () => {
  const checked = check()
  const result = verifiedOrigins(checked, [
    verdict(draft.id, { actor: "assistant" }),
    verdict(mixed.id, { actor: "user", supportedBy: "user", quote: USER_REQUEST, partial: true }),
    verdict(pure.id, { actor: "user", supportedBy: "user", quote: USER_REQUEST }),
    verdict(neutral.id, {}),
  ])
  if (!result.succeeded) throw new Error(result.problems.join("; "))
  const ledger = ledgerOf([...records, rectifiedRecord("rectified", rectifiedData(checked, result.output))])
  const observations = ledger.ranges.flatMap((range) => range.observations)
  const partial = observations.find((item) => item.id === mixed.id)
  if (!partial) throw new Error("mixed observation missing from ledger")
  expect(partial).toMatchObject({ origin: "partial", sources: ["user"], userWords: [USER_REQUEST] })
  const words = `User wrote: "${USER_REQUEST}".`
  expect(presentedContent(partial)).toBe(`${words} ${ORIGIN_MARKS.unconfirmed} ${mixed.content}`)
  expect(captureMaterial(observations)).toEqual([
    { label: mixed.id, text: words },
    { label: pure.id, text: pure.content },
    { label: neutral.id, text: neutral.content },
  ])
})

test("an omission placeholder is not original source evidence", () => {
  const transcript = [
    { ...assistantRecord("assistant", "", 22), parts: [{ kind: "omitted" as const, text: "" }] },
    observationsRecord("observed", "assistant", "assistant", [draft]),
  ]
  expect(materialSources(transcript, { fromId: "assistant", coversUpToId: "assistant" }, 100)).toEqual([])
})

test("repair accepts only a literal quote from the visible prefix of the original non-user source", () => {
  const pending = [{ id: draft.id, origin: "material" as const }]
  const repair = {
    id: draft.id,
    sourceId: "assistant",
    quote: ASSISTANT_DRAFT,
    content: "Assistant drafted an example heading rule.",
  }
  const sources = materialSources(records, check(), ASSISTANT_DRAFT.length)
  expect(repairedObservations(sources, pending, [repair])).toEqual([{ ...pending[0], ...repair }])
  for (const quote of [ASSISTANT_DRAFT.toLowerCase(), `${ASSISTANT_DRAFT.slice(0, -1)}!`, ASSISTANT_REASON]) {
    expect(repairedObservations(sources, pending, [{ ...repair, quote }])).toEqual(pending)
  }
})
