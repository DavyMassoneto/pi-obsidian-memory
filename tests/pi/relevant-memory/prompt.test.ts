import { expect, test } from "vitest"

import { classifierPrompt } from "#src/pi"

const question = { type: "bool", instructions: "Is it needed?", criteria: { true: "yes", false: "no" } } as const

test("a memory question becomes a classifier prompt with the same state, as a copy", () => {
  const state = { message: "pnpm?", project: "loja", folder: "work" }

  const prompt = classifierPrompt({ state, questions: { needed: question } })

  expect(prompt).toEqual({ state, questions: { needed: question } })
  expect(prompt.state).not.toBe(state)
})

test("a candidate question becomes a classifier prompt with the candidate's statement and body", () => {
  const state = { message: "pnpm?", candidate: { statement: "Use pnpm", body: "Always pnpm." } }

  const prompt = classifierPrompt({ state, questions: { relevant: question } })

  expect(prompt).toEqual({ state, questions: { relevant: question } })
  expect(prompt.state).not.toBe(state)
})
