import { readdir } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { MemoryAddParamsSchema, type MemoryAddResponse, memoryConfigPath, runMemoryAdd } from "#/pi"
import { readNote } from "#/services"
import { aConfig, useTempVault, writeConfig } from "#test-helpers"

const params = {
  scope: "global" as const,
  folder: "tools/pnpm",
  statement: "Use pnpm, never npm",
  type: "rule" as const,
  body: "Use pnpm everywhere.",
  dontForget: false,
}

async function setup() {
  const root = await useTempVault()
  const config = {
    ...aConfig(),
    global: { vault: join(root, "Global memory") },
    projects: [],
  }
  return { root, context: { configPath: await writeConfig(root, config), workingFolder: "D:/Downloads" } }
}

function textOf(response: MemoryAddResponse): string {
  const texts = response.content.flatMap((part) => {
    if (part.type === "text") {
      return [part.text]
    }

    return []
  })

  return texts.join("")
}

test("asks for every parameter, with a description for the model", () => {
  const properties = Object.entries(MemoryAddParamsSchema.properties)

  expect(MemoryAddParamsSchema.required.sort()).toEqual(
    ["body", "dontForget", "folder", "scope", "statement", "type"].sort(),
  )
  expect(properties.every(([, schema]) => "description" in schema)).toBe(true)
  expect(MemoryAddParamsSchema.properties.type.enum).toHaveLength(12)
})

test("asks for the folder, the statement and the body in English", () => {
  const { folder, statement, body } = MemoryAddParamsSchema.properties

  for (const schema of [folder, statement, body]) {
    expect(schema.description).toContain("in English")
  }
})

test("tells the model where the memory was saved", async () => {
  const { context } = await setup()

  const response = await runMemoryAdd(params, context)

  expect(textOf(response)).toBe("Saved in Global memory: tools/pnpm/Use pnpm, never npm.md")
  expect(response.isError).toBe(false)
})

test("passes every parameter on to the note", async () => {
  const { root, context } = await setup()

  await runMemoryAdd({ ...params, type: "lesson", dontForget: true }, context)

  expect(await readNote(join(root, "Global memory"), "tools/pnpm", params.statement)).toMatchObject({
    output: { note: { body: params.body, frontmatter: { type: "lesson", dontForget: true } } },
  })
})

test("shows the existing note and asks to check with the user when the name is taken", async () => {
  const { context } = await setup()
  await runMemoryAdd(params, context)

  const response = await runMemoryAdd({ ...params, body: "Something else." }, context)

  expect(response.isError).toBe(true)
  expect(textOf(response)).toBe(
    [
      "Not saved: tools/pnpm/Use pnpm, never npm.md already exists.",
      "",
      "Current note (rule):",
      "Use pnpm everywhere.",
      "",
      "If it is the same point, ask the user before changing it; otherwise choose a statement that says what is new.",
    ].join("\n"),
  )
})

test("lists every problem of an invalid note", async () => {
  const { root, context } = await setup()

  const response = await runMemoryAdd({ ...params, statement: "Use a: b", body: "" }, context)

  expect(response.isError).toBe(true)
  expect(textOf(response)).toBe(
    ["Not saved. Fix and call again:", '- statement: ":" is not allowed in a file name', "- body: is empty"].join("\n"),
  )
  expect(await readdir(root)).toEqual(["config.json"])
})

test("asks the model to check with the user when the folder has no project", async () => {
  const { context } = await setup()

  const response = await runMemoryAdd({ ...params, scope: "project" }, context)

  expect(response.isError).toBe(true)
  expect(textOf(response)).toBe(
    [
      "D:/Downloads has no registered project: run /memory-init, or use the global scope",
      "Ask the user whether to run /memory-init or save it as global.",
    ].join("\n"),
  )
})

test("passes other refusals on as they come", async () => {
  const { root } = await setup()

  const response = await runMemoryAdd(params, {
    configPath: join(root, "missing.json"),
    workingFolder: "D:/Downloads",
  })

  expect(response.isError).toBe(true)
  expect(textOf(response)).toBe("memory is not configured: run /memory-setup")
})

test("keeps the config in the pi agent folder", () => {
  expect(memoryConfigPath(join("C:", "agent"))).toBe(join("C:", "agent", "pi-obsidian-memory", "config.json"))
})
