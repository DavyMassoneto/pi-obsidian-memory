import { mkdir } from "node:fs/promises"
import { join } from "node:path"

import { expect, test } from "vitest"

import { SHELL_EDIT_REFUSED, SHELL_EDIT_UNCHECKED } from "#src/domain"
import {
  changedFixtureFiles,
  e2eWorld,
  endOf,
  fileExists,
  LABELLED_SHELL_COMMANDS,
  type LabelledShellCommand,
  lastEndOf,
  resetShellEditProject,
  startDownloadSource,
  toolCallPrompt,
  toolStartCommands,
  toolText,
  type WorldOptions,
  withDownloadSource,
} from "#test-helpers"

const options: WorldOptions = {
  memory: "none",
  tools: ["bash", "powershell"],
  modelCache: "fresh",
  capture: "after-each-turn",
  offlineNpm: true,
}

async function expectRanAsLabelled(item: LabelledShellCommand, text: string, cwd: string): Promise<void> {
  expect.soft(text, item.command).not.toContain(SHELL_EDIT_REFUSED)
  expect.soft(text, item.command).not.toContain(SHELL_EDIT_UNCHECKED)
  if (typeof item.output === "string") expect.soft(text, item.command).toContain(item.output)
  for (const path of item.removes) {
    expect.soft(await fileExists(join(cwd, path)), `${item.command} removes ${path}`).toBe(false)
  }
  for (const path of item.creates) {
    expect.soft(await fileExists(join(cwd, path)), `${item.command} creates ${path}`).toBe(true)
  }
}

async function expectRefusedWithoutChange(item: LabelledShellCommand, text: string, cwd: string): Promise<void> {
  expect.soft(text, item.command).toContain(SHELL_EDIT_REFUSED)
  for (const path of item.creates) {
    expect.soft(await fileExists(join(cwd, path)), `${item.command} must not create ${path}`).toBe(false)
  }
  expect.soft(await changedFixtureFiles(cwd), item.command).toEqual([])
}

test("with no memory config, every labelled command is refused or runs as labelled, and the disk confirms each one", async () => {
  const world = await e2eWorld(options)
  const { cwd } = world.folders
  const downloadSource = await startDownloadSource()
  for (const item of LABELLED_SHELL_COMMANDS) {
    await resetShellEditProject(cwd)
    await world.pi.newSession()
    const command = withDownloadSource(item.command, downloadSource)
    const turn = await world.pi.prompt(toolCallPrompt(item.shell, JSON.stringify({ command })), [])
    const message = `${item.command} | assistant: ${await world.pi.lastAssistantText()}`
    expect.soft(toolStartCommands(turn), message).toEqual([[item.shell, command]])
    const end = lastEndOf(turn, item.shell)
    expect.soft(end, message).not.toBeNull()
    if (!end) continue
    const text = toolText(end)
    if (item.expected === "allow") await expectRanAsLabelled(item, text, cwd)
    else await expectRefusedWithoutChange(item, text, cwd)
  }
})

test("a script that cannot be read refuses the command with the cause", async () => {
  const world = await e2eWorld(options)
  await resetShellEditProject(world.folders.cwd)
  await mkdir(join(world.folders.cwd, "locked.js"))
  const turn = await world.pi.prompt(toolCallPrompt("bash", JSON.stringify({ command: "node locked.js" })), [])
  const end = endOf(turn, "bash")
  expect(end.isError).toBe(true)
  expect(toolText(end)).toContain(SHELL_EDIT_UNCHECKED)
  expect(toolText(end)).toContain("locked.js")
})

test("when Jev cannot answer, every shell command is refused with the cause", async () => {
  const world = await e2eWorld({ ...options, withoutTypesafeKey: true })
  await resetShellEditProject(world.folders.cwd)
  const turn = await world.pi.prompt(
    toolCallPrompt("powershell", JSON.stringify({ command: "Get-Content src.txt" })),
    [],
  )
  const end = endOf(turn, "powershell")
  expect(end.isError).toBe(true)
  expect(toolText(end)).toContain(SHELL_EDIT_UNCHECKED)
  console.info(`no-key cause: ${toolText(end)}`)
})
