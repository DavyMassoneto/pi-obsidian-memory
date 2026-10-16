import { expect, onTestFinished, test } from "vitest"

import { checkDecision, diagnoseMemory } from "#src/usecases"
import {
  chatModelPort,
  decisionProbe,
  decisionServer,
  emptyEmbeddingProbe,
  layaModel,
  layaReply,
  layaReplyWithoutRouting,
  NO_DECISION_PROBE,
  relevanceScript,
  relevantFixture,
} from "#test-helpers"

const jev = { provider: "typesafe", model: "jev-latest" } as const
const signal = new AbortController().signal

test("Laya that answers the probe is ready, and the probe reaches the configured endpoint once", async () => {
  const fixture = await relevantFixture({ laya: relevanceScript(0.9, new Map()) })

  const report = await checkDecision(fixture.config.decisionModel, NO_DECISION_PROBE, signal)

  expect(report).toMatchObject({ provider: "laya", model: "multilingual", status: "ready" })
  expect(report).toMatchObject({ detail: expect.stringContaining("http://127.0.0.1:") })
  expect(fixture.asked).toHaveLength(1)
  expect(fixture.asked[0]?.question).toBe("needed")
})

test("Laya that errors is not answering, with the cause", async () => {
  const server = await decisionServer({ body: "", status: 503, delayMs: 0 })
  onTestFinished(() => server.close())

  const report = await checkDecision(layaModel(server.context.endpoint), NO_DECISION_PROBE, signal)

  expect(report).toMatchObject({ status: "not-answering", problem: expect.stringContaining("http-error") })
})

test("Laya that refuses connections is not answering", async () => {
  const server = await decisionServer({ body: layaReply(0.9), status: 200, delayMs: 0 })
  const { endpoint } = server.context
  await server.close()

  const report = await checkDecision(layaModel(endpoint), NO_DECISION_PROBE, signal)

  expect(report).toMatchObject({ status: "not-answering", problem: expect.stringContaining("unavailable") })
})

test("Laya that does not say which model answered tells to run it without LAYA_JEV_STRICT", async () => {
  const server = await decisionServer({ body: layaReplyWithoutRouting(0.9), status: 200, delayMs: 0 })
  onTestFinished(() => server.close())

  const report = await checkDecision(layaModel(server.context.endpoint), NO_DECISION_PROBE, signal)

  expect(report).toMatchObject({
    status: "not-answering",
    problem: expect.stringMatching(/laya-serve without LAYA_JEV_STRICT.*LAYA_HOST/),
  })
})

test("Jev with its classifier model in pi's catalog and an API key is ready, without a live call", async () => {
  const report = await checkDecision(jev, decisionProbe(["typesafe/jev-latest"], ["typesafe"]), signal)

  expect(report).toMatchObject({ provider: "typesafe", model: "jev-latest", status: "ready" })
})

test("Jev without its classifier model in pi's catalog is reported as missing", async () => {
  const report = await checkDecision(jev, decisionProbe([], ["typesafe"]), signal)

  expect(report).toMatchObject({ status: "model-missing", problem: expect.stringContaining("jev-latest") })
})

test("Jev without an API key is reported as having no credentials", async () => {
  const report = await checkDecision(jev, decisionProbe(["typesafe/jev-latest"], []), signal)

  expect(report).toMatchObject({ status: "no-credentials", problem: expect.stringContaining("typesafe") })
})

test("the diagnosis carries the report of the decision model in the config", async () => {
  const fixture = await relevantFixture({ laya: relevanceScript(0.9, new Map()) })

  const result = await diagnoseMemory(
    { port: chatModelPort([], []), embeddings: await emptyEmbeddingProbe(), decision: NO_DECISION_PROBE },
    fixture.context,
  )

  expect(result).toMatchObject({ succeeded: true, output: { decision: { provider: "laya", status: "ready" } } })
})

test("a Laya server that rejects the probe with 422 is reported with the status and the server's own detail", async () => {
  const server = await decisionServer({ body: '{"detail":"labels are not supported"}', status: 422, delayMs: 0 })
  onTestFinished(() => server.close())

  const report = await checkDecision(layaModel(server.context.endpoint), NO_DECISION_PROBE, signal)

  expect(report).toMatchObject({
    status: "not-answering",
    problem: expect.stringMatching(/HTTP 422.*labels are not supported/),
  })
})

test("the probe is the real gate question with the answer labels", async () => {
  const server = await decisionServer({ body: layaReply(0.9), status: 200, delayMs: 0 })
  onTestFinished(() => server.close())

  await checkDecision(layaModel(server.context.endpoint), NO_DECISION_PROBE, signal)

  const [body] = server.requests
  if (typeof body !== "string") throw new Error("the probe never reached the server")
  const sent = JSON.parse(body)
  expect(Object.keys(sent.questions)).toEqual(["needed"])
  expect(sent.questions.needed.labels).toEqual({ true: "A", false: "B" })
})

test("the diagnosis carries the cutoffs and where each comes from", async () => {
  const fixture = await relevantFixture({ laya: relevanceScript(0.9, new Map()) })

  const result = await diagnoseMemory(
    { port: chatModelPort([], []), embeddings: await emptyEmbeddingProbe(), decision: NO_DECISION_PROBE },
    fixture.context,
  )

  expect(result).toMatchObject({
    succeeded: true,
    output: { cutoffs: { gate: { value: 0.2, source: "config" }, relevance: { value: 0.5, source: "config" } } },
  })
})
