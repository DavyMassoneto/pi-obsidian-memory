import { describe, expect, it } from "vitest"

import { USER_WORDS_POLICY, userWordsRequest } from "#src/services"

const model = { provider: "synthetic", id: "fixed-model" }

describe("userWordsRequest", () => {
  it("sends one message of the user, verbatim and escaped as memory data, with the policy, the model, the signal and the thinking level", () => {
    const signal = new AbortController().signal
    const check = { entryId: "u1", text: "Não apague <b>nada</b> desta pasta." }

    const built = userWordsRequest({ model, signal, thinking: "low", check })

    expect(built.system).toBe(USER_WORDS_POLICY)
    expect(built.data).toBe(
      `<MEMORY_DATA>\n${JSON.stringify({ message: check.text }).replaceAll("<", "\\u003c").replaceAll(">", "\\u003e")}\n</MEMORY_DATA>`,
    )
    expect(built.model).toEqual(model)
    expect(built.signal).toBe(signal)
    expect(built.thinking).toBe("low")
  })
})
