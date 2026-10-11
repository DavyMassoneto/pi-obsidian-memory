import { expect, test } from "vitest"

import { isLoopbackEndpoint } from "#/domain"

test.each(["http://127.0.0.1:8000/v1/systemone", "https://[::1]:9000/v1/systemone", "http://127.1/v1/systemone"])(
  "preserves the existing parsed loopback URL policy: %s",
  (endpoint) => {
    expect(isLoopbackEndpoint(endpoint)).toBe(true)
  },
)

test.each([
  "http://localhost:8000/v1/systemone",
  "http://127.0.0.2:8000/v1/systemone",
  "http://127.0.0.1.example.com/v1/systemone",
  "http://user:secret@127.0.0.1/v1/systemone",
  "http://[::1]/v1/systemone?secret=value",
  "http://[::1]/v1/systemone#fragment",
  "http://[::1]/other",
  "file:///v1/systemone",
  "not-a-url",
])("rejects endpoints outside the unchanged decision resource policy: %s", (endpoint) => {
  expect(isLoopbackEndpoint(endpoint)).toBe(false)
})
