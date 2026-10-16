import { expect, test } from "vitest"

import { createMemorySession, type GetMemoryRequest, getMemory, listMemory } from "#src/usecases"
import {
  expectRegistrationLeaseReleased,
  memoryReadFixture,
  noteText,
  putCatalogFile,
  sessionIdentity,
  validFrontmatterLines,
} from "#test-helpers"

test("captures request and context synchronously before waiting for the session lease", async () => {
  const first = await memoryReadFixture()
  const second = await memoryReadFixture()
  await putCatalogFile(first.vault, "Note.md", noteText(validFrontmatterLines(), "first"))
  const original = { ...first.context }
  const lease = await original.session.acquire(original.stamp, original.signal)
  if (!lease) throw new Error("lease required")
  const request: GetMemoryRequest = { vault: "global", path: "Note.md", sourceCallId: "original" }
  const pending = getMemory(request, first.context)
  request.path = "redirect.md"
  request.vault = "project"
  request.sourceCallId = "redirected"
  Object.assign(first.context, second.context)
  first.context.signal = AbortSignal.abort()
  lease.release()
  expect(await pending).toMatchObject({
    succeeded: true,
    output: { file: { path: "Note.md", analysis: { parsed: { body: "first" } } } },
  })
  expect(original.session.getReceipt(original.stamp, { vault: "global", path: "Note.md" })).toMatchObject({
    sourceCallId: "original",
  })
  expect(second.context.session.getReceipt(second.context.stamp, { vault: "global", path: "Note.md" })).toBeNull()
  await expectRegistrationLeaseReleased(original)
})

test("queued stale authority cannot be upgraded by replacing caller stamp and signal", async () => {
  const { context, vault } = await memoryReadFixture()
  await putCatalogFile(vault, "Note.md", noteText(validFrontmatterLines(), "body"))
  const lease = await context.session.acquire(context.stamp, context.signal)
  if (!lease) throw new Error("lease required")
  const pending = getMemory({ vault: "global", path: "Note.md", sourceCallId: "stale" }, context)
  context.session.invalidate(sessionIdentity())
  context.stamp = context.session.stamp()
  context.signal = context.session.signal(context.stamp)
  lease.release()
  expect(await pending).toMatchObject({ succeeded: false })
  expect(context.session.getReceipt(context.stamp, { vault: "global", path: "Note.md" })).toBeNull()
  await expectRegistrationLeaseReleased(context)
})

test("cancelled admission cannot consume or refresh an existing receipt", async () => {
  const { context, controller, vault } = await memoryReadFixture()
  await putCatalogFile(vault, "Note.md", noteText(validFrontmatterLines(), "body"))
  const request: GetMemoryRequest = { vault: "global", path: "Note.md", sourceCallId: "first" }
  await getMemory(request, context)
  const lease = await context.session.acquire(context.stamp, context.signal)
  if (!lease) throw new Error("lease required")
  const pending = getMemory({ ...request, sourceCallId: "cancelled" }, context)
  controller.abort()
  lease.release()
  expect(await pending).toMatchObject({ succeeded: false })
  expect(context.session.getReceipt(context.stamp, request)).toMatchObject({ sourceCallId: "first" })
  await expectRegistrationLeaseReleased(context)
})

test("list captures cancellation identity before admission and never creates a receipt", async () => {
  const { context, vault, controller } = await memoryReadFixture()
  await putCatalogFile(vault, "folder/index.md", "original")
  const lease = await context.session.acquire(context.stamp, context.signal)
  if (!lease) throw new Error("lease required")
  const request = { vault: "global", folder: "folder" }
  const pending = listMemory({ ...request, vault: "global" }, context)
  context.session = createMemorySession(sessionIdentity())
  context.stamp = context.session.stamp()
  context.signal = new AbortController().signal
  controller.abort()
  lease.release()
  expect(await pending).toMatchObject({ succeeded: false })
})

test.each(["cancel", "invalidate"])(
  "%s after admission and before the config await resumes grants no receipt",
  async (action) => {
    const { context, vault, controller } = await memoryReadFixture()
    await putCatalogFile(vault, "Note.md", noteText(validFrontmatterLines(), "body"))
    const pending = getMemory({ vault: "global", path: "Note.md", sourceCallId: "interrupted" }, context)
    await Promise.resolve()
    if (action === "cancel") controller.abort()
    if (action === "invalidate") context.session.invalidate(sessionIdentity())
    expect(await pending).toMatchObject({ succeeded: false })
    expect(context.session.getReceipt(context.session.stamp(), { vault: "global", path: "Note.md" })).toBeNull()
    await expectRegistrationLeaseReleased(context)
  },
)
