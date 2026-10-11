import { mkdir, rm } from "node:fs/promises"

import { expect, test } from "vitest"

import { type GetMemoryRequest, getMemory, resolveMemory } from "#/usecases"
import {
  expectRegistrationLeaseReleased,
  memoryReadFixture,
  noteText,
  putCatalogFile,
  validFrontmatterLines,
  writeRegistrationSnapshot,
} from "#test-helpers"

test("valid to invalid config clears all authority before a fresh stamp reports lexical problems", async () => {
  const { vault, context, config } = await memoryReadFixture()
  const request: GetMemoryRequest = { vault: "global", path: "Note.md", sourceCallId: "old" }
  await putCatalogFile(vault, request.path, noteText(validFrontmatterLines(), "body"))
  await getMemory(request, context)
  await writeRegistrationSnapshot(context, JSON.stringify({ ...config, extra: true }))
  expect(await resolveMemory(context)).toMatchObject({ succeeded: false, reason: "stale-session" })
  context.stamp = context.session.stamp()
  expect(context.session.getReceipt(context.stamp, request)).toBeNull()
  expect(await resolveMemory(context)).toMatchObject({ succeeded: false, reason: "invalid-config" })
  await expectRegistrationLeaseReleased(context)
})

test.each(["missing", "directory"])(
  "%s config invalidates existing authority without a sentinel hash",
  async (state) => {
    const { vault, context } = await memoryReadFixture()
    const request: GetMemoryRequest = { vault: "global", path: "Note.md", sourceCallId: "old" }
    await putCatalogFile(vault, request.path, noteText(validFrontmatterLines(), "body"))
    await getMemory(request, context)
    await rm(context.configPath)
    let reason = "not-configured"
    if (state === "directory") {
      await mkdir(context.configPath)
      reason = "config-unavailable"
    }
    expect(await resolveMemory(context)).toMatchObject({ succeeded: false, reason })
    expect(context.session.isCurrent(context.stamp)).toBe(false)
    expect(context.session.getReceipt(context.session.stamp(), request)).toBeNull()
    await expectRegistrationLeaseReleased(context)
  },
)

test("snapshot invalidation does not invalidate a newer stamp created by a synchronous abort listener", async () => {
  const { context, config } = await memoryReadFixture()
  expect((await resolveMemory(context)).succeeded).toBe(true)
  context.session.signal(context.stamp).addEventListener("abort", () => {
    context.session.invalidate({ sessionId: "new", branchId: null })
  })
  await writeRegistrationSnapshot(context, JSON.stringify({ ...config, extra: true }))
  expect(await resolveMemory(context)).toMatchObject({ succeeded: false, reason: "stale-session" })
  expect(context.session.stamp()).toMatchObject({ sessionId: "new", generation: 2 })
})

test("cancelled and stale callers cannot invalidate newer authority when configuration is gone", async () => {
  const { vault, context } = await memoryReadFixture()
  const old = { ...context }
  context.session.invalidate(context.stamp)
  context.stamp = context.session.stamp()
  const request: GetMemoryRequest = { vault: "global", path: "Note.md", sourceCallId: "new" }
  await putCatalogFile(vault, request.path, noteText(validFrontmatterLines(), "body"))
  await getMemory(request, context)
  await rm(context.configPath)
  expect(await resolveMemory(old)).toMatchObject({ succeeded: false, reason: "stale-session" })
  expect(await resolveMemory({ ...context, signal: AbortSignal.abort() })).toMatchObject({
    succeeded: false,
    reason: "cancelled",
  })
  expect(context.session.getReceipt(context.stamp, request)).toMatchObject({ sourceCallId: "new" })
})
