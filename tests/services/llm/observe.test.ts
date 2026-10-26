import { describe, expect, it } from "vitest"

import { OBSERVER_PROMPT, observerData, observerRequest } from "#src/services"

const chunk = "const add = (a: Array<number>) => a.length\nnpm run build > out.txt\n<div>TS2322</div>"
const now = "2026-10-26T13:35:07"
const model = { provider: "synthetic", id: "fixed-model" }

describe("observerRequest", () => {
  it("sends the chunk verbatim, with no memory-data wrapper and no escaping", () => {
    const request = observerRequest({ model, signal: new AbortController().signal, thinking: "low", chunk, now })
    expect(request.system).toBe(OBSERVER_PROMPT)
    expect(request.data).toBe(observerData(chunk, now))
    expect(request.data).toContain(chunk)
    expect(request.data).not.toContain("MEMORY_DATA")
    expect(request.data).not.toContain("\\u003")
  })

  it("carries the model, the signal and the thinking level", () => {
    const signal = new AbortController().signal
    const request = observerRequest({ model, signal, thinking: "high", chunk, now })
    expect(request.model).toEqual(model)
    expect(request.signal).toBe(signal)
    expect(request.thinking).toBe("high")
  })
})
