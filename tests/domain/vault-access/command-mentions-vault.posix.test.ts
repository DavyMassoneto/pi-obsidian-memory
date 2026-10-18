import { expect, test } from "vitest"

import { commandMentionsVault, type PathPlatform } from "#src/domain"

const CWD = "/home/ana/project"
const HOME = "/home/ana"
const VAULT = "/home/ana/vaults/Global"
const PLATFORMS: PathPlatform[] = ["linux", "darwin"]

test.each(PLATFORMS)("finds a vault written in posix forms on %s", (platform) => {
  const commands = [
    "cat /home/ana/vaults/Global/x.md",
    "curl file:///home/ana/vaults/Global/x.md",
    "cat $HOME/vaults/Global/x.md",
    "cat ~/vaults/Global/x.md",
    "cat ../vaults/Global/x.md",
  ]

  for (const command of commands) {
    expect(commandMentionsVault(command, CWD, HOME, [VAULT], platform)).toBe(VAULT)
  }
})

test.each(PLATFORMS)("does not find a vault in a name that continues on %s", (platform) => {
  const commands = ["cat /home/ana/vaults/Globalx/x.md", "cat ../vaults/Globalx/x.md", "echo hello"]

  for (const command of commands) {
    expect(commandMentionsVault(command, CWD, HOME, [VAULT], platform)).toBeNull()
  }
})

test("keeps case significant on linux", () => {
  const command = "cat /home/ana/vaults/global/x.md"

  expect(commandMentionsVault(command, CWD, HOME, [VAULT], "linux")).toBeNull()
  expect(commandMentionsVault(command, CWD, HOME, [VAULT], "darwin")).toBe(VAULT)
})

test("does not split a posix name at a backslash on linux", () => {
  const command = "cat /home/ana/vaults\\Global/x.md"

  expect(commandMentionsVault(command, CWD, HOME, [VAULT], "linux")).toBeNull()
})

test("finds a vault when the working folder is inside it", () => {
  expect(commandMentionsVault("ls", `${VAULT}/tools`, HOME, [VAULT], "linux")).toBe(VAULT)
})
