import { expect, test } from "vitest"

import { argumentTokens } from "#src/domain"

test.each([
  ["whitespace", "ls  memory  x", ["ls", "memory", "x"]],
  ["shell operators", "cd a && cat b|sort;(echo c)", ["cd", "a", "cat", "b", "sort", "echo", "c"]],
  ["an equals sign", "tool --dir=memory", ["tool", "--dir", "memory"]],
  ["a double-quoted string as one token", 'git commit -m "fix vault mem"', ["git", "commit", "-m", "fix vault mem"]],
  ["a single-quoted string as one token", "echo 'a b'", ["echo", "a b"]],
  ["a backtick string as one token", "echo `a b`", ["echo", "a b"]],
  ["operators inside quotes", 'echo "a;b=c"', ["echo", "a;b=c"]],
  ["a quote inside a word", 'D:\\"My Notes"\\a', ["D:\\My Notes\\a"]],
  ["an empty command", "", []],
  ["an empty quoted string", 'echo ""', ["echo"]],
])("splits on %s", (_case, command, expected) => {
  expect(argumentTokens(command)).toEqual(expected)
})
