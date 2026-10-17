import { expect, test } from "vitest"

import { commandWords } from "#src/domain"

test.each([
  ["node write.js", ["node", "write.js"]],
  ["  node \t write.js  ", ["node", "write.js"]],
  ['node "my scripts/write file.js"', ["node", "my scripts/write file.js"]],
  ["node 'my scripts/write file.js'", ["node", "my scripts/write file.js"]],
  ['node "it\'s.js"', ["node", "it's.js"]],
  ["deno run --allow-write=out write.ts", ["deno", "run", "--allow-write=out", "write.ts"]],
  ["", []],
  ["   ", []],
])("%j splits into %j", (segment, expected) => {
  expect(commandWords(segment)).toEqual(expected)
})
