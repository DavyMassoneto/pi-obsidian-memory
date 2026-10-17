import { readFile, writeFile } from "node:fs/promises"

import { expect, test } from "vitest"

import { CHEAP_LABEL, SCREEN, savedConfig, screenContext, settingsFixture } from "#test-helpers"

test("choosing a capture model from the priced list writes it, and the next screen shows it", async () => {
  const { pi, workingFolder, configPath, config } = await settingsFixture()
  const { context, prompts, notifications } = screenContext(
    workingFolder,
    [SCREEN.captureModel, CHEAP_LABEL, SCREEN.done],
    {},
  )

  await pi.runCommand("memory-setup", context)

  expect((await savedConfig(configPath)).capture).toEqual({
    ...config.capture,
    model: { provider: "cheap-co", id: "haiku" },
  })
  expect(prompts[1]?.options).toEqual(["test-chat/selected-chat (current)", CHEAP_LABEL])
  expect(prompts[2]?.options[0]).toBe("Capture model: cheap-co/haiku")
  expect(notifications).toEqual([{ message: expect.stringContaining("Saved"), type: "info" }])
  expect(notifications[0]?.message).not.toContain("/reload")
})

test("the memory-agent model has its own list and its own setting", async () => {
  const { pi, workingFolder, configPath, config } = await settingsFixture()
  const { context, prompts } = screenContext(workingFolder, [SCREEN.agentModel, CHEAP_LABEL, SCREEN.done], {})

  await pi.runCommand("memory-setup", context)

  const saved = await savedConfig(configPath)
  expect(saved.memoryAgent.model).toEqual({ provider: "cheap-co", id: "haiku" })
  expect(saved.capture).toEqual(config.capture)
  expect(prompts[1]?.title).toContain("memory agent")
})

test("Escape on a model list keeps the current model and writes nothing", async () => {
  const { pi, workingFolder, configPath } = await settingsFixture()
  const before = await readFile(configPath, "utf8")
  const { context, notifications } = screenContext(workingFolder, [SCREEN.captureModel, undefined, SCREEN.done], {})

  await pi.runCommand("memory-setup", context)

  expect(await readFile(configPath, "utf8")).toBe(before)
  expect(notifications).toEqual([])
})

test("when capture runs is chosen from the three moments", async () => {
  const { pi, workingFolder, configPath } = await settingsFixture()
  const { context, prompts } = screenContext(workingFolder, [SCREEN.captureWhen, "at session end", SCREEN.done], {})

  await pi.runCommand("memory-setup", context)

  expect((await savedConfig(configPath)).capture.when).toBe("at-session-end")
  expect(prompts[1]?.options).toEqual(["after each turn (current)", "on compaction", "at session end"])
})

test.each([
  ["a threshold", SCREEN.gate, "0.4", "decisionModel", { gateThreshold: 0.4 }],
  ["the other threshold", SCREEN.relevance, "0", "decisionModel", { relevanceThreshold: 0 }],
  ["the context budget", SCREEN.budget, "500", "context", { budgetChars: 500 }],
  ["the note body limit", SCREEN.maxBody, "7", "limits", { maxBodyChars: 7 }],
  ["the statement limit", SCREEN.maxStatement, "9", "limits", { maxStatementChars: 9 }],
  ["the notes per folder", SCREEN.maxNotes, "30", "limits", { maxNotesPerFolder: 30 }],
])("typing %s writes it", async (_name, line, typed, section, expected) => {
  const { pi, workingFolder, configPath } = await settingsFixture()
  const { context } = screenContext(workingFolder, [line, SCREEN.done], { inputs: [typed] })

  await pi.runCommand("memory-setup", context)

  expect((await savedConfig(configPath))[section]).toMatchObject(expected)
})

test.each([
  ["a threshold that is not a number", SCREEN.gate, "abc", "must be a number from 0 to 1"],
  ["a threshold above 1", SCREEN.relevance, "1.5", "must be a number from 0 to 1"],
  ["a budget of zero", SCREEN.budget, "0", "must be a whole number of 1 or more"],
  ["a limit that is not whole", SCREEN.maxBody, "2.5", "must be a whole number of 1 or more"],
])(
  "%s is refused with its reason, the file stays as it was and the screen comes back",
  async (_name, line, typed, reason) => {
    const { pi, workingFolder, configPath } = await settingsFixture()
    const before = await readFile(configPath, "utf8")
    const { context, prompts, notifications } = screenContext(workingFolder, [line, SCREEN.done], { inputs: [typed] })

    await pi.runCommand("memory-setup", context)

    expect(await readFile(configPath, "utf8")).toBe(before)
    expect(notifications).toEqual([{ message: expect.stringContaining(reason), type: "error" }])
    expect(prompts.filter((prompt) => prompt.kind === "select")).toHaveLength(2)
  },
)

test("an empty answer or Escape on a number keeps the current value, and 'none' clears a cutoff", async () => {
  const { pi, workingFolder, configPath, config } = await settingsFixture()
  await writeFile(
    configPath,
    JSON.stringify({ ...config, decisionModel: { ...config.decisionModel, gateThreshold: 0.3 } }),
  )
  const gate = "Gate cutoff: 0.3 (set)"
  const kept = screenContext(workingFolder, [gate, gate, SCREEN.done], { inputs: ["", undefined] })
  await pi.runCommand("memory-setup", kept.context)
  expect((await savedConfig(configPath)).decisionModel.gateThreshold).toBe(0.3)
  expect(kept.notifications).toEqual([])

  const cleared = screenContext(workingFolder, [gate, SCREEN.done], { inputs: ["none"] })
  await pi.runCommand("memory-setup", cleared.context)

  expect(await savedConfig(configPath)).toMatchObject({ decisionModel: { provider: "laya" } })
  expect((await savedConfig(configPath)).decisionModel).not.toHaveProperty("gateThreshold")
})

test("a file edited while a question is open is a conflict: nothing is overwritten and the screen reloads", async () => {
  const { pi, workingFolder, configPath, config } = await settingsFixture()
  const answer = Promise.withResolvers<string | undefined>()
  const { context, prompts, notifications } = screenContext(workingFolder, [SCREEN.budget, SCREEN.done], {
    inputs: [answer.promise],
  })

  const running = pi.runCommand("memory-setup", context)
  await new Promise<void>((resolve) => setTimeout(resolve, 50))
  await writeFile(configPath, JSON.stringify({ ...config, context: { budgetChars: 99 } }))
  answer.resolve("500")
  await running

  expect((await savedConfig(configPath)).context).toEqual({ budgetChars: 99 })
  expect(notifications).toEqual([{ message: expect.stringContaining("changed on disk"), type: "error" }])
  expect(prompts.filter((prompt) => prompt.kind === "select")[1]?.options).toContain("Context budget: 99 characters")
})
