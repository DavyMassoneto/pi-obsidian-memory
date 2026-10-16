import { mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"

import { expect } from "vitest"

import { readConfigSnapshot } from "#src/services"
import {
  type ChatModelReference,
  type ConfigRepairDraft,
  createMemorySession,
  prepareMemorySetup,
  proposeMemorySetup,
  type RegistrationContext,
  type SetupVaultMode,
} from "#src/usecases"
import { sessionIdentity } from "./session.ts"
import { productSettings } from "./settings.ts"
import { useTempFolder } from "./temp-folder.ts"

export async function registrationUsecaseFixture() {
  const root = await useTempFolder()
  const session = createMemorySession(sessionIdentity())
  const controller = new AbortController()
  const context: RegistrationContext = {
    configPath: join(root, "machine", "config.json"),
    workingFolder: join(root, "work"),
    indexPath: join(root, "machine", "index"),
    session,
    stamp: session.stamp(),
    signal: controller.signal,
  }
  const config = { global: { vault: join(root, "global") }, projects: [], ...productSettings() }
  const request = { config, expectedHash: null, replacementConfirmed: false, disclosuresConfirmed: true }
  return { root, context, controller, config, request }
}

export async function writeRegistrationSnapshot(context: RegistrationContext, text: string): Promise<string> {
  await mkdir(dirname(context.configPath), { recursive: true })
  await writeFile(context.configPath, text)
  const snapshot = await readConfigSnapshot({ path: context.configPath })
  if (!snapshot.succeeded || snapshot.output.state !== "present") throw new Error("snapshot unavailable")
  return snapshot.output.hash
}

export async function registrationDiskTree(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true })
  const files: string[] = []
  for (const entry of entries) {
    files.push(entry.name)
    if (entry.isDirectory()) {
      for (const path of await registrationDiskTree(join(root, entry.name))) files.push(`${entry.name}/${path}`)
    }
  }
  return files.sort()
}

export async function expectRegistrationAssets(vault: string): Promise<void> {
  expect(await readdir(vault)).toEqual(["Memory.base", "_templates"])
  expect(await readdir(join(vault, "_templates"))).toEqual([
    "constraint.md",
    "decision.md",
    "fact.md",
    "goal.md",
    "idea.md",
    "issue.md",
    "lesson.md",
    "procedure.md",
    "question.md",
    "reference.md",
    "risk.md",
    "rule.md",
  ])
  expect(await readFile(join(vault, "Memory.base"), "utf8")).toContain("views:")
  for (const name of await readdir(join(vault, "_templates"))) {
    expect(await readFile(join(vault, "_templates", name), "utf8")).toContain(`type: ${name.slice(0, -3)}`)
  }
}

export async function expectRegistrationLeaseReleased(context: RegistrationContext): Promise<void> {
  await context.session.drain()
  const lease = await context.session.acquire(context.session.stamp(), AbortSignal.timeout(1000))
  expect(lease).not.toBeNull()
  lease?.release()
}

export async function setupPreparationOf(context: RegistrationContext, selectedModel: ChatModelReference | null) {
  const preparation = await prepareMemorySetup({ selectedModel }, context)
  if (!preparation.succeeded) throw new Error(preparation.problems.join("\n"))
  return preparation.output
}

export function proposeVaultMode(
  context: RegistrationContext,
  draft: ConfigRepairDraft,
  vault: string,
  mode: SetupVaultMode,
) {
  return proposeMemorySetup({ draft, vault, mode }, context)
}
