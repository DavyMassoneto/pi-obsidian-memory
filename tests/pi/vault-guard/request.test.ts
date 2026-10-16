import { join } from "node:path"

import { expect, test } from "vitest"

import { accessRequestsOf } from "#src/pi"
import { toolCallEvent } from "#test-helpers"

const cwd = join("work", "project")

test.each(["write", "edit"])("%s is a vault file request and a config write request on the same path", (tool) => {
  expect(accessRequestsOf(toolCallEvent(tool, { path: "a/b.md" }), cwd)).toEqual([
    { kind: "file", path: "a/b.md" },
    { kind: "config-write", path: "a/b.md" },
  ])
})

test("read is a file request, ls a listing and bash or powershell a command", () => {
  expect(accessRequestsOf(toolCallEvent("read", { path: "a.md" }), cwd)).toEqual([{ kind: "file", path: "a.md" }])
  expect(accessRequestsOf(toolCallEvent("ls", { path: "dir" }), cwd)).toEqual([{ kind: "listing", path: "dir" }])
  expect(accessRequestsOf(toolCallEvent("ls", {}), cwd)).toEqual([{ kind: "listing", path: cwd }])
  for (const tool of ["bash", "powershell"]) {
    expect(accessRequestsOf(toolCallEvent(tool, { command: "ls" }), cwd)).toEqual([{ kind: "command", command: "ls" }])
  }
})

test("a tool that is not known gives no request", () => {
  expect(accessRequestsOf(toolCallEvent("other_tool", { path: "a.md" }), cwd)).toEqual([])
})

test.each([
  ["grep", "glob"],
  ["find", "pattern"],
] as const)("%s searches the root, and the %s literal prefix as written and under the root", (tool, field) => {
  const request = toolCallEvent(tool, { pattern: "x", path: "root", [field]: "vault/sub/**/*.md" })

  expect(accessRequestsOf(request, cwd)).toEqual([
    { kind: "tree", path: "root" },
    { kind: "tree", path: "vault/sub/" },
    { kind: "tree", path: join("root", "vault/sub/") },
  ])
})

test.each(["*.md", "**/*.md", "?x", "[ab]/c", "{a,b}/c"])(
  "a glob %s with no literal prefix adds only the root",
  (glob) => {
    expect(accessRequestsOf(toolCallEvent("find", { pattern: glob }), cwd)).toEqual([{ kind: "tree", path: cwd }])
  },
)

test("a pattern with no metacharacter is a literal path and is checked whole", () => {
  expect(accessRequestsOf(toolCallEvent("find", { pattern: "../vault/Note.md", path: "root" }), cwd)).toEqual([
    { kind: "tree", path: "root" },
    { kind: "tree", path: "../vault/Note.md" },
    { kind: "tree", path: join("root", "../vault/Note.md") },
  ])
})
