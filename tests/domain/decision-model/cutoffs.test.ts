import { expect, it } from "vitest"

import { defaultCutoffs } from "#src/domain"

it("gives Jev the documented starting cutoffs", () => {
  expect(defaultCutoffs("typesafe")).toStrictEqual({ gate: 0.5, relevance: 0.5 })
})

it("gives Laya no default, since its measurement is too small to use as one", () => {
  expect(defaultCutoffs("laya")).toStrictEqual({})
})
