import { expect, test } from "vitest"

import { disclosureText } from "#src/pi"

test("the disclosure names each chosen item on its own line, then asks for the confirmation", () => {
  const text = disclosureText(["chat-models", "jev", "remote-embeddings"])
  const lines = text.split("\n")

  expect(lines).toHaveLength(4)
  expect(lines[0]).toContain("chat model")
  expect(lines[1]).toContain("TypeSafe")
  expect(lines[2]).toContain("embeddings")
  expect(lines[3]).toBe(lines.at(-1))
})

test("only the chosen items are named", () => {
  const text = disclosureText(["chat-models"])

  expect(text).toContain("chat model")
  expect(text).not.toContain("TypeSafe")
  expect(text.split("\n")).toHaveLength(2)
})

test("with nothing to disclose only the confirmation line remains", () => {
  expect(disclosureText([]).split("\n")).toHaveLength(1)
})
