import { expect, test } from "vitest"

import { captureMaterial, isSourceRecord, ledgerOf, ORIGIN_MARKS, selectPromotion } from "#src/domain"
import { COMPACTION_DETAILS_TYPE } from "#src/usecases"
import {
  compactionsIn,
  E2E_MODEL,
  E2E_PROVIDER,
  ExtensionErrorSchema,
  inconclusiveNoticeWorld,
  NotifySchema,
  noticeChatRuns,
  noticeFrom,
  noticePiVersion,
  recordsOf,
  retryNoticeSession,
  vaultNotes,
} from "#test-helpers"

const fail = "Memory could not check the origin of observations: Model call unsupported. It tries again in a minute."
const closed =
  "Memory could not check the origin of 6 observation(s) after 3 attempts: they stay marked as unconfirmed and are not saved as notes."
const done = "Memory consolidated: 6 observation(s), 0 change(s) to the vaults."
const ack = "Reply with just ACK and do not call any tools."

test("real Pi reports exhaustion without claiming verification or saving any of the six observations as notes", async () => {
  const world = await inconclusiveNoticeWorld()
  const { pi, file, vault, config, history, observations, source, sourceRecord } = world
  const before = await vaultNotes(vault)
  expect(before).toEqual([])

  for (let attempt = 1; attempt <= 3; attempt++) {
    if (attempt > 1) await retryNoticeSession(pi, file)
    const from = pi.lines.length
    await pi.prompt(ack, [])
    expect(await noticeFrom(pi, ["Memory could not check the origin of"], from)).toMatchObject({
      message: fail,
      notifyType: "warning",
    })
    const records = history()
    expect(records.filter((r) => r.kind === "rectify-failed" && r.data.recordId === sourceRecord)).toHaveLength(attempt)
    expect(records.some((r) => r.kind === "rectified")).toBe(false)
  }

  const preCompaction = history()
  const sourceIndex = preCompaction.findIndex(({ id }) => id === source)
  config.compaction.tailTokens = preCompaction
    .slice(sourceIndex + 1)
    .filter(isSourceRecord)
    .reduce((sum, record) => sum + record.tokens, 0)
  expect(config.compaction.tailTokens).toBeGreaterThan(0)
  await world.saveConfig()
  await retryNoticeSession(pi, file)
  const closing = pi.lines.length
  await pi.compact()
  const closureNotice = await noticeFrom(
    pi,
    ["Memory could not check the origin of", "Memory checked the origin of"],
    closing,
  )
  expect(closureNotice).toMatchObject({ message: closed, notifyType: "info" })
  expect(
    recordsOf(NotifySchema, pi.lines.slice(closing))
      .map((n) => n.message)
      .join("\n"),
  ).not.toContain("Memory checked the origin")

  const compacted = (await compactionsIn(file)).at(-1)
  expect(compacted).toMatchObject({ fromHook: true, details: { type: COMPACTION_DETAILS_TYPE } })
  expect(compacted?.summary).toContain("has no confirmed attribution to the user (including when the check failed)")
  expect(compacted?.summary).not.toContain("was checked and could not")
  const ledger = ledgerOf(history())
  const items = ledger.ranges
    .flatMap((range) => range.observations)
    .filter((o) => observations.some(({ id }) => id === o.id))
  expect(items).toEqual(observations.map((item) => ({ ...item, origin: "unconfirmed" })))
  for (const { id, content } of items) {
    expect(compacted?.summary.split("\n")).toContain(`${id}  ${ORIGIN_MARKS.unconfirmed} ${content}`)
  }
  const candidates = selectPromotion(ledger, config.consolidator.poolTargetTokens)
  expect(candidates).toEqual(items)
  expect(captureMaterial(candidates)).toEqual([])
  expect(await vaultNotes(vault)).toEqual(before)

  config.consolidator.atPoolTokens = 1
  await world.saveConfig()
  const consolidating = pi.lines.length
  await pi.prompt(ack, [])
  const consolidationNotice = await noticeFrom(
    pi,
    ["Memory consolidated:", "Memory consolidation failed:"],
    consolidating,
  )
  expect(consolidationNotice).toMatchObject({ message: done, notifyType: "info" })
  const after = history()
  expect(after.filter((record) => record.kind === "consolidated").map(({ data }) => data.observationIds)).toEqual([
    observations.map(({ id }) => id),
  ])
  expect(after.filter((record) => record.kind === "note-written")).toEqual([])
  const saved = ledgerOf(after).ranges.flatMap((range) => range.observations)
  expect(saved.filter((item) => items.some((original) => original.id === item.id))).toEqual(items)
  expect(await vaultNotes(vault)).toEqual(before)
  expect(
    after.filter((record) => record.kind === "rectify-failed" && record.data.recordId === sourceRecord),
  ).toHaveLength(3)
  expect(after.filter((record) => record.kind === "rectified" && record.data.recordId === sourceRecord)).toHaveLength(1)
  const chat = noticeChatRuns(file)
  expect(chat.runs).toHaveLength(4)
  for (const run of chat.runs)
    expect(run).toMatchObject({ provider: E2E_PROVIDER, model: E2E_MODEL, stopReason: "stop" })
  expect(recordsOf(ExtensionErrorSchema, pi.lines)).toEqual([])
  expect(pi.unexpected).toEqual([])
  console.log(
    JSON.stringify({
      ...chat,
      version: await noticePiVersion(),
      consolidator: config.consolidator.model,
      sourceRecord,
      closureNotice,
      consolidationNotice,
      marked: items.length,
      eligibleForNotes: captureMaterial(candidates).length,
      notesBefore: before.length,
      notesAfter: (await vaultNotes(vault)).length,
    }),
  )
})
