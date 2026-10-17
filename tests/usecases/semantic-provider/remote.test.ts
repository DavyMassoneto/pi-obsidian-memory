import { expect, test } from "vitest"

import { createRemoteSemantic } from "#src/usecases"

const signal = new AbortController().signal

test.each(["openai", "google"] as const)(
  "the %s port is available and refuses an empty request before any network call",
  async (provider) => {
    const port = createRemoteSemantic(provider, "key")

    const result = await port.embed({ purpose: "document", inputs: [] }, { signal })

    expect(port.available).toBe(true)
    expect(result).toMatchObject({ succeeded: false, status: "invalid-input" })
  },
)
