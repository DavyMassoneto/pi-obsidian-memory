import { describe, expect, it } from "vitest"

import { decideMemory } from "#/services"
import { layaContext, memoryDecisionRequest } from "#test-helpers"

describe("Laya endpoint restriction", () => {
  it.each([
    "http://example.com/v1/systemone",
    "https://example.com/v1/systemone",
    "http://localhost.example.com/v1/systemone",
    "http://localhost:8000/v1/systemone",
    "http://user:secret@127.0.0.1:8000/v1/systemone",
    "http://127.0.0.1:8000/v1/systemone?key=secret",
    "http://127.0.0.1:8000/v1/systemone#secret",
    "http://127.0.0.1:8000/other-api",
    "file:///tmp/model",
    "not-a-url",
  ])("refuses unsafe endpoint %s before transmission", async (endpoint) => {
    expect(await decideMemory({ context: layaContext(endpoint), request: memoryDecisionRequest })).toMatchObject({
      succeeded: false,
      code: "unsafe-endpoint",
    })
  })
})
