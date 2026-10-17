import { expect, test } from "vitest"

import { commandSegments } from "#src/domain"

test.each([
  ["a && b", ["a", "b"]],
  ["a; b", ["a", "b"]],
  ["a | b", ["a", "b"]],
  ['echo "x && y"', ['echo "x && y"']],
  ["   ", []],
])("%j splits into %j", (command, expected) => {
  expect(commandSegments(command).map((segment) => segment.trim())).toEqual(expected)
})
