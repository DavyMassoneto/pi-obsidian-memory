import { expect, test } from "vitest"

import { aConfig, DEFAULT_CADENCE, inspectConfigForRepair, parseConfig, proposeSetup } from "#test-helpers"

test.each([
  { provider: "local", model: "text-embedding-3-small" },
  { provider: "local", model: "gemini-embedding-001" },
  { provider: "openai", model: "Xenova/multilingual-e5-small" },
  { provider: "openai", model: "gemini-embedding-001" },
  { provider: "google", model: "Xenova/multilingual-e5-small" },
  { provider: "google", model: "text-embedding-3-small" },
])("preservation: recognized contradictory embeddings remain unresolved: %j", (embeddings) => {
  const draft = inspectConfigForRepair(JSON.stringify({ ...aConfig(), embeddings }))
  expect(draft.embeddings).toEqual(embeddings)
  expect(draft.problems).toEqual([expect.stringContaining("embeddings.model")])
  expect(proposeSetup({ config: draft, vault: "C:/replacement" }).succeeded).toBe(false)
})

test.each([
  { provider: "typesafe", model: "multilingual" },
  {
    provider: "laya",
    model: "jev-latest",
    endpoint: "http://127.0.0.1:9000/v1/systemone",
    maxTokens: 4000,
    headMaxTokens: 100,
  },
])("preservation: recognized contradictory decision choices remain unresolved: %j", (decisionModel) => {
  const draft = inspectConfigForRepair(JSON.stringify({ ...aConfig(), decisionModel }))
  expect(draft.decisionModel).toEqual(decisionModel)
  expect(draft.problems).toEqual([expect.stringContaining("decisionModel.model")])
  expect(proposeSetup({ config: draft, vault: "C:/replacement" }).succeeded).toBe(false)
})

test.each(["Xenova/multilingual-e5-small", "text-embedding-3-small", "gemini-embedding-001"])(
  "preservation: missing embedding provider retains recognized model %s with explicit local repair default",
  (model) => {
    const draft = inspectConfigForRepair(JSON.stringify({ ...aConfig(), embeddings: { model } }))
    expect(draft.embeddings).toEqual({ provider: "local", model })
    expect(draft.problems).toEqual(["embeddings: must have required properties provider"])
    expect(proposeSetup({ config: draft, vault: "C:/replacement" }).succeeded).toBe(
      model === "Xenova/multilingual-e5-small",
    )
  },
)

test.each(["multilingual", "jev-latest"])(
  "preservation: missing decision provider retains model %s and independently valid Laya siblings",
  (model) => {
    const decisionModel = { model, endpoint: "http://127.0.0.1:9000/v1/systemone", maxTokens: 4000, headMaxTokens: 100 }
    const draft = inspectConfigForRepair(JSON.stringify({ ...aConfig(), decisionModel }))
    expect(draft.decisionModel).toEqual({ provider: "laya", ...decisionModel })
    expect(draft.problems).toEqual(["decisionModel: must have required properties provider"])
    expect(proposeSetup({ config: draft, vault: "C:/replacement" }).succeeded).toBe(model === "multilingual")
  },
)

test("old configuration is invalid at runtime and repair never invents a chat model", () => {
  const old = { global: { vault: "C:/global" }, projects: [], limits: { maxBodyChars: 777, maxStatementChars: 77 } }
  const text = JSON.stringify(old)
  const parsed = parseConfig(text)
  expect(parsed.succeeded).toBe(false)
  expect(parsed).not.toHaveProperty("output")
  if (parsed.succeeded) throw new Error("old config accepted")
  for (const field of ["maxNotesPerFolder", "capture", "memoryAgent", "context", "embeddings", "decisionModel"]) {
    expect(parsed.problems.join(" ")).toContain(field)
  }
  expect(inspectConfigForRepair(text)).toMatchObject({
    ...old,
    limits: { ...old.limits, maxNotesPerFolder: 20 },
    capture: { model: {}, ...DEFAULT_CADENCE },
    memoryAgent: { model: {} },
  })
})

test("repair keeps a valid observer model and thinking level and fills missing numbers with defaults", () => {
  const { observer: _observer, compaction: _compaction, ...rest } = aConfig()
  const observer = { model: { provider: "keep-provider", id: "keep-id" }, thinking: "high" }
  const draft = inspectConfigForRepair(JSON.stringify({ ...rest, observer, compaction: { tailTokens: 777 } }))

  expect(draft.observer).toEqual({ ...observer, chunkTokens: 10000, concurrency: 4 })
  expect(draft.compaction).toEqual({ atContextTokens: 150000, tailTokens: 777, mapTokens: 2000 })
  expect(draft.problems).toEqual([
    "observer: must have required properties chunkTokens",
    "observer: must have required properties concurrency",
    "compaction: must have required properties atContextTokens",
    "compaction: must have required properties mapTokens",
  ])
})

test("repair never invents an observer model and drops an invalid thinking level for the default", () => {
  const config = aConfig()
  const draft = inspectConfigForRepair(
    JSON.stringify({ ...config, observer: { ...config.observer, model: {}, thinking: "extreme" } }),
  )

  expect(draft.observer).toEqual({ ...config.observer, model: {}, thinking: "low" })
})

test("repair retains independently valid nested siblings and names discarded unknown fields", () => {
  const text = JSON.stringify({
    ...aConfig(),
    capture: { model: { provider: "keep", id: " ", apiKey: "discard-secret" }, when: "at-session-end", extra: 1 },
    memoryAgent: { model: { provider: false, id: "keep-id" } },
    limits: { maxBodyChars: 700, maxStatementChars: 0, maxNotesPerFolder: 31 },
    context: { budgetChars: 5678, extra: 1 },
  })
  const draft = inspectConfigForRepair(text)
  expect(draft.capture).toEqual({
    model: { provider: "keep" },
    ...DEFAULT_CADENCE,
    reviewEnabled: false,
    flushOnCompact: false,
  })
  expect(draft.memoryAgent).toEqual({ model: { id: "keep-id" } })
  expect(draft.limits).toEqual({ maxBodyChars: 700, maxStatementChars: 100, maxNotesPerFolder: 31 })
  expect(draft.context).toEqual({ budgetChars: 5678 })
  expect(draft.problems).toEqual(
    expect.arrayContaining([
      "capture.model.apiKey: not a known field",
      "capture.extra: not a known field",
      "context.extra: not a known field",
    ]),
  )
  expect(JSON.stringify(draft)).not.toContain("discard-secret")
})

test("repair retains supported sibling values and names invalid, missing and unknown fields", () => {
  const input = { ...aConfig(), limits: { maxBodyChars: 700, extra: 5 }, surprise: true }
  const draft = inspectConfigForRepair(JSON.stringify(input))
  expect(draft).toMatchObject({
    replacementRequired: false,
    global: input.global,
    projects: input.projects,
    limits: { maxBodyChars: 700, maxStatementChars: 100 },
    problems: expect.arrayContaining([
      expect.stringContaining("maxStatementChars"),
      expect.stringContaining("extra"),
      expect.stringContaining("surprise"),
    ]),
  })
})

test("repair retains valid fields of damaged project entries without choosing a conflict winner", () => {
  const config = aConfig()
  const draft = inspectConfigForRepair(
    JSON.stringify({
      ...config,
      projects: [
        { name: "loja", folder: "D:/Projects/loja", vault: 7, extra: true },
        { name: "LOJA", folder: "D:/Projects/other", vault: "C:/other" },
      ],
    }),
  )
  expect(draft.projects).toEqual([
    { name: "loja", folder: "D:/Projects/loja" },
    { name: "LOJA", folder: "D:/Projects/other", vault: "C:/other" },
  ])
  expect(draft.problems.join(" ")).toContain("projects.0.vault")
  expect(draft.problems.join(" ")).toContain("projects.1.name")
})

test("syntactically invalid JSON explicitly requires confirmed replacement", () => {
  expect(inspectConfigForRepair("{ broken")).toMatchObject({
    replacementRequired: true,
    global: {},
    projects: [],
    limits: { maxBodyChars: 1000, maxStatementChars: 100 },
    problems: [expect.stringContaining("not valid JSON")],
  })
})

test("repair never silently defaults runtime parse or drops a valid sibling after wrong limit", () => {
  expect(inspectConfigForRepair(JSON.stringify({ limits: { maxBodyChars: 0, maxStatementChars: 42 } }))).toMatchObject({
    limits: { maxBodyChars: 1000, maxStatementChars: 42 },
    global: {},
    projects: [],
    replacementRequired: false,
  })
})

test("the default decision model is Jev when nothing says otherwise", () => {
  const jev = { provider: "typesafe", model: "jev-latest" }
  expect(inspectConfigForRepair("{}").decisionModel).toEqual(jev)
  expect(inspectConfigForRepair(JSON.stringify({ ...aConfig(), decisionModel: {} })).decisionModel).toEqual(jev)
  expect(
    inspectConfigForRepair(JSON.stringify({ ...aConfig(), decisionModel: { model: "jev-latest" } })).decisionModel,
  ).toEqual(jev)
  expect(
    inspectConfigForRepair(JSON.stringify({ ...aConfig(), decisionModel: { gateThreshold: 0.4 } })).decisionModel,
  ).toEqual({ ...jev, gateThreshold: 0.4 })
})

test.each([
  ["provider laya", { provider: "laya" }],
  ["model multilingual", { model: "multilingual" }],
  ["an endpoint", { endpoint: "http://127.0.0.1:9000/v1/systemone" }],
  ["maxTokens", { maxTokens: 4000 }],
  ["headMaxTokens", { headMaxTokens: 100 }],
])("Laya stays the choice when the config shows %s", (_case, decisionModel) => {
  const repaired = inspectConfigForRepair(JSON.stringify({ ...aConfig(), decisionModel })).decisionModel
  expect(repaired).toEqual({
    provider: "laya",
    endpoint: "http://127.0.0.1:8000/v1/systemone",
    model: "multilingual",
    maxTokens: 8192,
    headMaxTokens: 192,
    ...decisionModel,
  })
})
