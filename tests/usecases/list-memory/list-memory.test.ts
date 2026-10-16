import { expect, test } from "vitest"

import { getMemory, type ListMemoryRequest, listMemory } from "#src/usecases"
import { expectRegistrationLeaseReleased, memoryReadFixture, memoryReadTree, putCatalogFile } from "#test-helpers"

test("list and get route actual folders including .md folders without minting receipts", async () => {
  const { root, vault, context } = await memoryReadFixture()
  for (const path of ["INDEX.MD", "folder/Index.md", "name.md/index.md"]) await putCatalogFile(vault, path, path)
  const before = await memoryReadTree(root)
  for (const folder of ["", "folder", "folder/", "name.md"]) {
    const listed = await listMemory({ vault: "global", folder }, context)
    expect(listed.succeeded).toBe(true)
    expect(await getMemory({ vault: "global", path: folder, sourceCallId: "folder" }, context)).toEqual(listed)
    expect(context.session.getReceipt(context.stamp, { vault: "global", path: folder })).toBeNull()
  }
  expect(await memoryReadTree(root)).toEqual(before)
  await expectRegistrationLeaseReleased(context)
})

test("list captures the admitted folder and scope before the caller mutates them", async () => {
  const { vault, context } = await memoryReadFixture()
  await putCatalogFile(vault, "original/index.md", "original")
  await putCatalogFile(vault, "redirected/index.md", "redirected")
  const lease = await context.session.acquire(context.stamp, context.signal)
  if (!lease) throw new Error("lease required")
  const request: ListMemoryRequest = { vault: "global", folder: "original" }
  const pending = listMemory(request, context)
  request.folder = "redirected"
  request.vault = "project"
  lease.release()
  expect(await pending).toMatchObject({ succeeded: true, output: { path: "original/index.md", text: "original" } })
  await expectRegistrationLeaseReleased(context)
})

test("list refuses files; get never interprets a missing or non-note file as a folder", async () => {
  const { vault, context } = await memoryReadFixture()
  await putCatalogFile(vault, "plain", "text")
  await putCatalogFile(vault, "note.md", "text")
  expect(await listMemory({ vault: "global", folder: "plain" }, context)).toMatchObject({
    succeeded: false,
    reason: "not-directory",
  })
  expect(await getMemory({ vault: "global", path: "plain", sourceCallId: "plain" }, context)).toMatchObject({
    succeeded: false,
    reason: "excluded",
  })
  expect(await getMemory({ vault: "global", path: "note.md/", sourceCallId: "slash" }, context)).toMatchObject({
    succeeded: false,
    reason: "not-directory",
  })
  expect(await getMemory({ vault: "global", path: "missing", sourceCallId: "missing" }, context)).toMatchObject({
    succeeded: false,
    reason: "not-found",
  })
  await expectRegistrationLeaseReleased(context)
})
