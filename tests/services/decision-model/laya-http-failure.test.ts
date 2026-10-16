import { describe, expect, it } from "vitest"

import { MAX_FAILURE_DETAIL_CHARS } from "#src/domain"
import { layaHttpFailure, layaHttpFailures } from "#src/services"

const diagnostics = { provider: "laya" as const, requestedModel: "multilingual", reportedModel: null, usage: null }

describe("layaHttpFailure", () => {
  it("carries the status and the string detail of an HTTP 422", async () => {
    const detail = "question 'needed': no 'instructions'; add the text the model should answer"
    const response = new Response(JSON.stringify({ detail }), { status: 422 })
    expect(await layaHttpFailure(response, diagnostics)).toEqual({
      succeeded: false,
      code: "http-error",
      httpStatus: 422,
      diagnostics,
      detail,
    })
  })

  it("bounds the detail with the domain limit without splitting a surrogate pair", async () => {
    const long = await layaHttpFailure(
      new Response(JSON.stringify({ detail: "x".repeat(900) }), { status: 422 }),
      diagnostics,
    )
    const emoji = await layaHttpFailure(
      new Response(JSON.stringify({ detail: "😀".repeat(400) }), { status: 422 }),
      diagnostics,
    )
    expect(long).toMatchObject({ detail: "x".repeat(MAX_FAILURE_DETAIL_CHARS) })
    if (!emoji.detail) throw new Error("No detail")
    expect(emoji.detail.length).toBeLessThanOrEqual(MAX_FAILURE_DETAIL_CHARS)
    expect(emoji.detail.isWellFormed()).toBe(true)
  })

  it.each([
    ["a status other than 422", 500, JSON.stringify({ detail: "boom" })],
    ["a validation list as detail", 422, JSON.stringify({ detail: [{ loc: ["body"], msg: "bad" }] })],
    ["an empty detail", 422, JSON.stringify({ detail: "" })],
    ["a body without detail", 422, JSON.stringify({ error: "sample-token" })],
    ["a body that is not JSON", 422, "sample-token"],
    ["an oversized body", 422, `${" ".repeat(65_536)}${JSON.stringify({ detail: "late" })}`],
  ])("has no detail for %s", async (_name, status, body) => {
    const failure = await layaHttpFailure(new Response(body, { status }), diagnostics)
    expect(failure).toEqual({ succeeded: false, code: "http-error", httpStatus: status, diagnostics })
    expect(JSON.stringify(failure)).not.toContain("sample-token")
  })
})

describe("layaHttpFailures", () => {
  it("gives every item its own diagnostics and the same status and detail", async () => {
    const other = { ...diagnostics, requestedModel: "english" }
    const response = new Response(JSON.stringify({ detail: "model not served" }), { status: 422 })
    expect(await layaHttpFailures(response, [diagnostics, other])).toEqual([
      { succeeded: false, code: "http-error", httpStatus: 422, diagnostics, detail: "model not served" },
      { succeeded: false, code: "http-error", httpStatus: 422, diagnostics: other, detail: "model not served" },
    ])
  })

  it("reads the body once for many items and returns nothing for none", async () => {
    const response = new Response(JSON.stringify({ detail: "x" }), { status: 422 })
    expect(await layaHttpFailures(response, [])).toEqual([])
    expect(response.bodyUsed).toBe(true)
  })
})
