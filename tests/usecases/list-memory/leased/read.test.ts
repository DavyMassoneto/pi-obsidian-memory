import { expect, test } from "vitest"

import { type GetMemoryRequest, getMemory, listMemory } from "#/usecases"
import { memoryReadFixture, noteText, putCatalogFile, validFrontmatterLines } from "#test-helpers"

test("folder listing cannot overwrite a prior get receipt and returns caller-owned index bytes", async () => {
  const { vault, context } = await memoryReadFixture()
  const request: GetMemoryRequest = { vault: "global", path: "Note.md", sourceCallId: "note" }
  await putCatalogFile(vault, request.path, noteText(validFrontmatterLines(), "body"))
  await putCatalogFile(vault, "Index.md", "edited index")
  await getMemory(request, context)
  const receipt = context.session.getReceipt(context.stamp, request)
  const result = await listMemory({ vault: "global", folder: "" }, context)
  if (!result.succeeded) throw new Error("index required")
  result.output.bytes.fill(0)
  result.output.text = "mutated"
  expect(await listMemory({ vault: "global", folder: "" }, context)).toMatchObject({
    succeeded: true,
    output: { text: "edited index", bytes: Buffer.from("edited index") },
  })
  expect(context.session.getReceipt(context.stamp, request)).toEqual(receipt)
  expect(context.session.getReceipt(context.stamp, { vault: "global", path: "" })).toBeNull()
})
