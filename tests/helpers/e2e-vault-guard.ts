import { join } from "node:path"

import { expect } from "vitest"

import { VAULT_ACCESS_REFUSAL } from "#src/domain"
import { onlyProject, rewriteConfig } from "./e2e-config.ts"
import { toolText } from "./e2e-records.ts"
import { callInNewSession, type StartedCall, startedCalls } from "./e2e-tool-calls.ts"
import { type E2eWorld, e2eWorld, type WorldOptions } from "./e2e-world.ts"

export function slashed(path: string): string {
  return path.replaceAll("\\", "/")
}

export function searches(glob: string, path?: string): StartedCall[] {
  return [
    { tool: "find", args: { pattern: glob, path } },
    { tool: "grep", args: { pattern: "x", glob, path } },
  ]
}

export function toolsOnVault(vault: string): StartedCall[] {
  const note = join(vault, "tools", "Use pnpm.md")
  return [
    { tool: "read", args: { path: note } },
    { tool: "write", args: { path: note, content: "replaced" } },
    { tool: "edit", args: { path: note, edits: [{ oldText: "Always pnpm.", newText: "Always npm." }] } },
    { tool: "grep", args: { pattern: "pnpm", path: vault } },
    { tool: "find", args: { pattern: "*.md", path: vault } },
    { tool: "ls", args: { path: join(vault, "tools") } },
  ]
}

export async function worldWithProjectVaultAsWorkingFolder(options: WorldOptions): Promise<E2eWorld> {
  const world = await e2eWorld(options)
  const project = await onlyProject(world)
  await rewriteConfig(world, { projects: [{ ...project, vault: world.folders.cwd }] })
  await world.restart()
  return world
}

export async function expectVaultRefusal(world: E2eWorld, call: StartedCall): Promise<void> {
  const label = JSON.stringify(call)
  const { turn, end } = await callInNewSession(world, call)
  expect.soft(startedCalls(turn), label).toEqual([call])
  expect.soft(end.isError, label).toBe(true)
  expect.soft(toolText(end), label).toBe(VAULT_ACCESS_REFUSAL)
}

export async function runAllowed(world: E2eWorld, call: StartedCall): Promise<string> {
  const label = JSON.stringify(call)
  const { turn, end } = await callInNewSession(world, call)
  expect.soft(startedCalls(turn), label).toEqual([call])
  expect.soft(end.isError, label).toBe(false)
  expect.soft(toolText(end), label).not.toContain(VAULT_ACCESS_REFUSAL)
  return toolText(end)
}
