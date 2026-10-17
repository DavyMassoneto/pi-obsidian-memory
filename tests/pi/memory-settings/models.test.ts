import { expect, test } from "vitest"

import { chooseModel, modelChoices, modelLabel } from "#src/pi"
import { fakePiContext } from "#test-helpers"

const cheap = { provider: "p", id: "cheap", cost: { input: 0.25, output: 1.25 } }
const mid = { provider: "p", id: "mid", cost: { input: 3, output: 15 } }
const opus = { provider: "anthropic", id: "opus", cost: { input: 15, output: 75 } }
const unpriced = { provider: "q", id: "unpriced" }
const OPUS_REF = { provider: "anthropic", id: "opus" }

test("a label shows provider/id and the price per million input and output tokens", () => {
  expect(modelLabel(cheap, null)).toBe("p/cheap · $0.25 in / $1.25 out per 1M tokens")
  expect(modelLabel(unpriced, null)).toBe("q/unpriced")
})

test("the choices are sorted by input price, cheapest first, and a model without a price comes last", () => {
  const choices = modelChoices([opus, unpriced, mid, cheap], {}, {})

  expect(choices.map((choice) => choice.reference.id)).toEqual(["cheap", "mid", "opus", "unpriced"])
  expect(choices.every((choice) => !choice.current)).toBe(true)
})

test("the current model comes first and is marked, with its price when pi knows it", () => {
  const choices = modelChoices([cheap, opus, mid], OPUS_REF, {})

  expect(choices.map((choice) => choice.reference.id)).toEqual(["opus", "cheap", "mid"])
  expect(choices[0]).toMatchObject({
    current: true,
    label: "anthropic/opus (current) · $15 in / $75 out per 1M tokens",
  })
})

test("with no current model the model in use comes first, marked, and the rest are sorted by price", () => {
  const choices = modelChoices([cheap, opus, mid], {}, OPUS_REF)

  expect(choices.map((choice) => choice.reference.id)).toEqual(["opus", "cheap", "mid"])
  expect(choices[0]).toMatchObject({
    current: true,
    label: "anthropic/opus (in use) · $15 in / $75 out per 1M tokens",
  })
})

test("the current model wins over the model in use", () => {
  const choices = modelChoices([cheap, opus], { provider: "p", id: "cheap" }, OPUS_REF)

  expect(choices.map((choice) => choice.label.split(" ")[0])).toEqual(["p/cheap", "anthropic/opus"])
  expect(choices[0]?.label).toContain("(current)")
  expect(choices[1]?.label).not.toContain("(in use)")
})

test("a current model that pi no longer lists is still offered, marked, without a price", () => {
  const choices = modelChoices([cheap], { provider: "gone", id: "old" }, {})

  expect(choices[0]).toMatchObject({ current: true, label: "gone/old (current)" })
  expect(choices).toHaveLength(2)
})

test("picking a label gives that model", async () => {
  const { context } = fakePiContext("work", {
    available: [opus, cheap],
    answers: { selects: ["p/cheap · $0.25 in / $1.25 out per 1M tokens"] },
  })

  expect(await chooseModel(context, "title", {}, {})).toEqual({ provider: "p", id: "cheap" })
})

test.each([undefined, ""])("answering %j keeps the current model", async (answer) => {
  const { context } = fakePiContext("work", { available: [cheap], answers: { selects: [answer] } })

  expect(await chooseModel(context, "title", { provider: "p", id: "cheap" }, {})).toEqual({
    provider: "p",
    id: "cheap",
  })
})

test.each([undefined, ""])("with no current model, answering %j takes the model in use", async (answer) => {
  const { context } = fakePiContext("work", { available: [cheap, opus], answers: { selects: [answer] } })

  expect(await chooseModel(context, "title", {}, OPUS_REF)).toEqual(OPUS_REF)
})

test("with neither a current model nor one in use, no answer chooses nothing", async () => {
  const { context } = fakePiContext("work", {
    available: [cheap],
    model: { provider: "p", id: "cheap" },
    answers: { selects: [undefined] },
  })

  expect(await chooseModel(context, "title", {}, {})).toBeNull()
})

test("an answer that is none of the labels changes nothing, even with a current model", async () => {
  const { context } = fakePiContext("work", { available: [cheap], answers: { selects: ["not in the list"] } })

  expect(await chooseModel(context, "title", { provider: "p", id: "cheap" }, {})).toBeNull()
})
