import { join } from "node:path"

import { expect, test } from "vitest"

import { memoryConfigPath } from "#src/pi"
import { addMemory } from "#src/usecases"
import { fakeToolContext, registerFakePiAt, setupRegisteredMemoryAdd, textOf } from "#test-helpers"

const params = {
  scope: "project" as const,
  folder: "tools/pnpm",
  statement: "Use pnpm, never npm",
  type: "lesson" as const,
  body: "Use pnpm everywhere.",
  dontForget: true,
}

test.each([
  ["project", "loja", true],
  ["global", "Global memory", false],
] as const)("the registered execute maps %s scope and every draft field", async (scope, vaultName, dontForget) => {
  const { agentDir, configPath, projectFolder } = await setupRegisteredMemoryAdd()
  const { tools } = registerFakePiAt(agentDir, {})
  const tool = tools[0]
  if (!tool) {
    throw new Error("memory tool was not registered")
  }
  const context = fakeToolContext(join(projectFolder, "src"))

  const input = { ...params, scope, dontForget }
  const response = await tool.execute("call-1", input, undefined, undefined, context)
  const existing = await addMemory(
    { scope, folder: params.folder, draft: input },
    { configPath, workingFolder: context.cwd },
  )

  expect(response).toEqual({
    content: [{ type: "text", text: `Saved in ${vaultName}: tools/pnpm/${params.statement}.md` }],
    details: undefined,
    isError: false,
  })
  expect(existing).toMatchObject({
    succeeded: false,
    reason: "exists",
    existing: {
      note: { statement: params.statement, body: params.body, frontmatter: { type: "lesson" } },
    },
  })
  if (existing.succeeded || !("existing" in existing)) {
    throw new Error("expected the saved note")
  }
  if (dontForget) {
    expect(existing.existing.note.frontmatter.dontForget).toBe(true)
  } else {
    expect(existing.existing.note.frontmatter).not.toHaveProperty("dontForget")
  }
})

test("the registered execute translates refusals without hiding their cause", async () => {
  const { agentDir, unregisteredFolder } = await setupRegisteredMemoryAdd()
  const { tools } = registerFakePiAt(agentDir, {})
  const tool = tools[0]
  if (!tool) {
    throw new Error("memory tool was not registered")
  }

  const response = await tool.execute("call-2", params, undefined, undefined, fakeToolContext(unregisteredFolder))

  expect(response.isError).toBe(true)
  expect(textOf(response)).toContain(`${unregisteredFolder} has no registered project`)
  expect(textOf(response)).toContain(memoryConfigPath(agentDir))
  expect(textOf(response)).toContain("global scope")
})
