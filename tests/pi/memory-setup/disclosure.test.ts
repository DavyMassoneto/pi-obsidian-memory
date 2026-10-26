import { expect, test } from "vitest"

import { disclosureText } from "#src/pi"

test("the disclosure is a title and one line for each chosen item, with no question", () => {
  const text = disclosureText(["chat-models", "jev", "remote-embeddings"])
  const lines = text.split("\n")

  expect(lines).toHaveLength(4)
  expect(lines[0]).toContain("what leaves this machine")
  expect(lines[1]).toContain("chat model")
  expect(lines[2]).toContain("TypeSafe")
  expect(lines[3]).toContain("embeddings")
  expect(text).not.toContain("?")
})

test("the chat models line names the observer and the memory agent", () => {
  expect(disclosureText(["chat-models"]).split("\n")[1]).toBe(
    "The observer and the memory agent send conversation and note content to the chat models you chose.",
  )
})

test("only the chosen items are named", () => {
  const text = disclosureText(["chat-models"])

  expect(text).toContain("chat model")
  expect(text).not.toContain("TypeSafe")
  expect(text.split("\n")).toHaveLength(2)
})

test("with nothing to disclose only the title remains", () => {
  expect(disclosureText([]).split("\n")).toHaveLength(1)
})
