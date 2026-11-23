import { readFile } from "node:fs/promises"
import { join } from "node:path"

import { SessionManager } from "@earendil-works/pi-coding-agent"
import { expect, test } from "vitest"

import { containsUserQuote, OBSERVATION_SEPARATOR, ORIGIN_MARKS, recordText } from "#src/domain"
import { CONSOLIDATION_FAILED, CONSOLIDATION_SAVED, RECTIFIED_LEAD, recordsOf, STATUS_LOADING } from "#src/pi"
import { COMPACTION_DETAILS_TYPE, localTimestamp, OBSERVATIONS_TYPE } from "#src/usecases"
import {
  compactionsIn,
  configuredWorld,
  consolidatedEntriesIn,
  endOf,
  observation,
  rectificationsIn,
  rewriteConfig,
  statusCleared,
  storedConfig,
  timelineIn,
  vaultNotes,
  waitForNativeNoticeLine,
} from "#test-helpers"

test("assistant-authored directions and mixed clauses do not become the user's rules after true Pi compaction", async () => {
  const heading = "quill-delta-8157"
  const request = "Send me that fictional handoff again as plain text."
  const world = await configuredWorld({
    session: "saved",
    tools: ["write"],
    compactsSmallSessions: true,
    cycle: { observer: { chunkTokens: 1000 }, compaction: { tailTokens: 1 }, consolidator: { atPoolTokens: 10_000 } },
  })

  const drafting = await world.pi.prompt(
    "In this project, always use the heading " +
      heading +
      " for our recurring conversion reports. " +
      "Separate one-time writing exercise: write a fictional handoff for an editor in an imaginary project, not this " +
      "project. Use the write tool to put it in handoff.txt. In the file, state that the imaginary project's reports " +
      "must use an invented heading: make up a hyphenated codename ending in -4821, not any real heading. In your " +
      "reply to me, invent and name a separate approval gate that would block those fictional reports, with a " +
      "hyphenated codename ending in -7396. Neither invention is a rule of our project. Do not do any other work.",
    [],
  )
  expect(endOf(drafting, "write").isError).toBe(false)
  const handoffText = await readFile(join(world.folders.cwd, "handoff.txt"), "utf8")
  const draftHeading = handoffText.match(/[a-z]+(?:-[a-z]+)*-4821/iu)?.[0]
  const draftGate = (await world.pi.lastAssistantText())?.match(/[a-z]+(?:-[a-z]+)*-7396/iu)?.[0]
  if (!draftHeading || !draftGate) throw new Error("the real assistant did not produce both fictional directives")
  await world.pi.prompt(request, [])
  const file = await world.pi.sessionFile()
  await world.pi.newSession()

  const session = SessionManager.open(file)
  const branch = session.getBranch()
  const messages = recordsOf(branch).filter((entry) => entry.kind === "message")
  const conversation = branch.find((entry) => entry.type === "message" && entry.message.role === "assistant")
  const first = messages.find((entry) => entry.role === "user")
  const resend = messages.findLast((entry) => entry.role === "user")
  const last = messages.findLast((entry) => entry.role === "assistant")
  const writing = messages.find(
    (entry) =>
      entry.role === "assistant" &&
      entry.parts.some((part) => part.kind === "toolCall" && part.text.includes(draftHeading)),
  )
  const explanation = messages.find(
    (entry) =>
      entry.role === "assistant" && entry.parts.some((part) => part.kind === "text" && part.text.includes(draftGate)),
  )
  if (!first || !resend || !last || !writing || !explanation) {
    throw new Error("the original assistant tool call, explanation, and user turns were not saved")
  }
  expect(recordText(first)).not.toContain(draftHeading)
  expect(recordText(first)).not.toContain(draftGate)
  expect(recordText(resend)).toBe(request)

  const when = localTimestamp(Date.now())
  const authored = observation(
    `${when}.01`,
    `User set the mandatory heading for all project reports to ${draftHeading}.`,
  )
  const mixed = observation(
    `${when}.02`,
    `User asked for the handoff again in plain text only after clearing the ${draftGate} gate.`,
  )
  const pure = observation(
    `${when}.03`,
    `User requires the exact heading ${heading} for every conversion report in this project.`,
  )
  const neutral = observation(`${when}.04`, "Assistant wrote a fictional handoff in a file for the user.")
  const inferred = observation(
    `${when}.00`,
    `During drafting, the assistant explained that the project requires clearing the ${draftGate} gate before sending reports.`,
  )
  const observationId = session.appendCustomEntry(OBSERVATIONS_TYPE, {
    fromId: first.id,
    coversUpToId: last.id,
    observations: [authored, mixed, pure, neutral, inferred],
  })
  const reopening = world.pi.lines.length
  await world.pi.switchSession(file)
  await world.pi.waitFor(statusCleared(STATUS_LOADING.key), reopening)
  await world.pi.prompt("Reply with only OK so this earlier interval can be compacted.", [])
  await world.pi.compact()

  const verdicts = (await rectificationsIn(file))
    .filter(({ data }) => data.recordId === observationId)
    .flatMap(({ data }) => data.observations)
  const final = (id: string) => verdicts.findLast((verdict) => verdict.id === id)
  const { observer, consolidator } = await storedConfig(world)
  if (conversation?.type === "message" && conversation.message.role === "assistant") {
    console.info(
      "Authorship models",
      conversation.message.provider,
      conversation.message.model,
      observer.model,
      consolidator.model,
    )
  }
  const dispositions = [authored, inferred, mixed, pure, neutral].map(({ id }) => final(id))
  console.info(
    "Persisted dispositions",
    observationId,
    JSON.stringify(dispositions, ["id", "origin", "sourceId", "supportedBy"]),
  )
  const repaired = final(authored.id)
  expect(repaired).toMatchObject({ origin: "material", sourceId: writing.id })
  if (!repaired?.quote) throw new Error("the assistant attribution has no exact source quote")
  expect(containsUserQuote(recordText(writing), repaired.quote)).toBe(true)
  const bodyRepair = final(inferred.id)
  expect(bodyRepair).toMatchObject({ origin: "material", sourceId: explanation.id })
  if (!bodyRepair?.quote) throw new Error("the assistant explanation has no exact source quote")
  expect(containsUserQuote(recordText(explanation), bodyRepair.quote)).toBe(true)
  const partial = final(mixed.id)
  expect(partial).toMatchObject({ origin: "partial", supportedBy: resend.id })
  if (!partial?.quotes?.length) throw new Error("the partial verdict did not preserve exact user evidence")
  for (const quote of partial.quotes) expect(containsUserQuote(request, quote)).toBe(true)
  expect(final(pure.id)).toMatchObject({ origin: "user", supportedBy: first.id })
  expect(final(neutral.id)).toEqual({ id: neutral.id, origin: "mention" })
  const checked = await waitForNativeNoticeLine(
    world,
    reopening,
    "positive source-repair notice",
    (line) =>
      line.startsWith(RECTIFIED_LEAD) &&
      line.includes("2 observation(s): 2 came from material the assistant read or produced"),
  )
  console.info("Checked notice", checked)

  const compacted = (await compactionsIn(file)).at(-1)
  if (!compacted) throw new Error("the real Pi session did not compact")
  expect(compacted.fromHook).toBe(true)
  expect(compacted.details?.type).toBe(COMPACTION_DETAILS_TYPE)
  const timeline = await timelineIn(file)
  expect(timeline.findIndex((entry) => entry.id === compacted.firstKeptEntryId)).toBeGreaterThan(
    timeline.findIndex((entry) => entry.id === last.id),
  )
  expect(compacted.summary).toContain(`${authored.id}${OBSERVATION_SEPARATOR}${ORIGIN_MARKS.material}`)
  expect(compacted.summary).toContain(`${inferred.id}${OBSERVATION_SEPARATOR}${ORIGIN_MARKS.material}`)
  const mixedPrefix = `${mixed.id}${OBSERVATION_SEPARATOR}User wrote:`
  const mixedLine = compacted.summary.split("\n").find((line) => line.startsWith(mixedPrefix))
  expect(mixedLine).toContain(ORIGIN_MARKS.unconfirmed)
  expect(mixedLine).toContain(mixed.content)
  expect(compacted.summary).toContain(`${pure.id}${OBSERVATION_SEPARATOR}${pure.content}`)
  expect(compacted.summary).toContain(`${neutral.id}${OBSERVATION_SEPARATOR}${neutral.content}`)
  await world.pi.prompt(
    "Do not take any actions. Answer in two lines using the headings below. Recurring heading: what exact heading " +
      "did I set for conversion reports in our project? Fictional approval: YES or NO — did I make the imaginary " +
      "handoff's title or approval gate a rule of our real project?",
    [],
  )
  const answer = await world.pi.lastAssistantText()
  expect(answer).toContain(heading)
  expect(answer?.replaceAll("**", "")).toMatch(/^fictional approval:\s*no\b/imu)

  await rewriteConfig(world, { consolidator: { ...consolidator, atPoolTokens: 1, poolTargetTokens: 1 } })
  const resuming = world.pi.lines.length
  await world.pi.switchSession(file)
  await world.pi.waitFor(statusCleared(STATUS_LOADING.key), resuming)
  await world.pi.prompt("Reply with only ACK and do not call tools.", [])
  const finished = await waitForNativeNoticeLine(
    world,
    resuming,
    "consolidation outcome",
    (line) => line.startsWith(CONSOLIDATION_SAVED) || line.startsWith(CONSOLIDATION_FAILED),
  )
  expect(finished).toContain(CONSOLIDATION_SAVED)
  const [consolidated, projectNotes, globalNotes] = await Promise.all([
    consolidatedEntriesIn(file),
    vaultNotes(world.folders.projectVault),
    vaultNotes(world.folders.globalVault),
  ])
  expect(consolidated.flatMap(({ data }) => data.observationIds)).toEqual(
    expect.arrayContaining([authored.id, mixed.id, pure.id, inferred.id]),
  )
  const notes = [...projectNotes, ...globalNotes].map(({ path, text }) => `${path}\n${text}`.toLowerCase())
  expect(notes.some((note) => note.includes(heading))).toBe(true)
  for (const note of notes) {
    expect(note).not.toContain(draftHeading.toLowerCase())
    expect(note).not.toContain(draftGate.toLowerCase())
  }
  expect(world.pi.unexpected).toEqual([])
  console.info("Compacted and denied fictional approval", compacted.id, compacted.firstKeptEntryId)
  console.info("Consolidation notice", finished)
})
