import { expect, test } from "vitest"

import { displayIndexName, displayIndexText } from "#/domain"

test.each([
  ["", "<code></code>"],
  [" ", "` `"],
  ["   ", "`   `"],
  ["Bad#name", "`Bad#name`"],
  ["Bad[[name]]", "`Bad[[name]]`"],
  ["Bad`name", "``Bad`name``"],
  ["Bad``name", "```Bad``name```"],
  ["`Bad#name`", "`` `Bad#name` ``"],
  [" Bad#name ", "`  Bad#name  `"],
])("displays a name literally without letting it close the code delimiter: %s", (name, rendered) => {
  expect(displayIndexName(name)).toBe(rendered)
})

test.each(["Bad[[target]]", "Bad[name](target)", "<a>name</a>", "`Bad#name`"])(
  "prevents markup in headings and diagnostics from creating links: %s",
  (text) => {
    expect(displayIndexText(text)).toBe(displayIndexName(text))
  },
)

test("leaves ordinary diagnostics readable as plain text", () => {
  expect(displayIndexText("body: is empty")).toBe("body: is empty")
})
