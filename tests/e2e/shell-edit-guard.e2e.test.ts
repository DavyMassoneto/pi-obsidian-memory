import { join } from "node:path"

import { expect, test } from "vitest"

import { SHELL_EDIT_REFUSED, SHELL_EDIT_UNCHECKED } from "#src/domain"
import {
  changedFixtureFiles,
  e2eWorld,
  fileExists,
  type LabelledShellCommand,
  lastEndOf,
  resetShellEditProject,
  toolCallPrompt,
  toolStartCommands,
  toolText,
  type WorldOptions,
} from "#test-helpers"

const options: WorldOptions = {
  memory: "none",
  tools: ["bash"],
  modelCache: "fresh",
}

const SHELL_COMMANDS: LabelledShellCommand[] = [
  { shell: "bash", command: "echo x > notes.txt", expected: "redirection", creates: ["notes.txt"], removes: [] },
  { shell: "bash", command: "cat src.txt", expected: "allow", creates: [], removes: [], output: "old line" },
]

async function expectRanAsLabelled(item: LabelledShellCommand, text: string): Promise<void> {
  expect.soft(text, item.command).not.toContain(SHELL_EDIT_REFUSED)
  expect.soft(text, item.command).not.toContain(SHELL_EDIT_UNCHECKED)
  if (typeof item.output === "string") expect.soft(text, item.command).toContain(item.output)
}

async function expectRefusedWithoutChange(item: LabelledShellCommand, text: string, cwd: string): Promise<void> {
  expect.soft(text, item.command).toContain(SHELL_EDIT_REFUSED)
  for (const path of item.creates) {
    expect.soft(await fileExists(join(cwd, path)), `${item.command} must not create ${path}`).toBe(false)
  }
  expect.soft(await changedFixtureFiles(cwd), item.command).toEqual([])
}

test("with no memory config, a file-editing command is refused and a read-only command runs, and the disk confirms each one", async () => {
  const world = await e2eWorld(options)
  const { cwd } = world.folders
  for (const item of SHELL_COMMANDS) {
    await resetShellEditProject(cwd)
    await world.pi.newSession()
    const turn = await world.pi.prompt(toolCallPrompt(item.shell, JSON.stringify({ command: item.command })), [])
    const message = `${item.command} | assistant: ${await world.pi.lastAssistantText()}`
    expect.soft(toolStartCommands(turn), message).toEqual([[item.shell, item.command]])
    const end = lastEndOf(turn, item.shell)
    expect.soft(end, message).not.toBeNull()
    if (!end) continue
    const text = toolText(end)
    if (item.expected === "allow") await expectRanAsLabelled(item, text)
    else await expectRefusedWithoutChange(item, text, cwd)
  }
})
