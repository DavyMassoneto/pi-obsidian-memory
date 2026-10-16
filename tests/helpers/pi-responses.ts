import { readFileSync } from "node:fs"
import { join, resolve } from "node:path"

import type { ChangeFailure } from "#src/pi"
import { renderDoctorReport, renderMemoryBlock, reportFailure, reportSuccess, respondToSearch } from "#src/pi"
import type { DontForgetVault, GetMemoryResult, LoadedDontForgetNote, SearchMemoryResult } from "#src/usecases"
import { diagnosedMemory } from "./diagnose-memory.ts"
import { textOf } from "./pi.ts"
import { deliveredRead } from "./session.ts"

const problems = ["a problem"]

const hit = {
  path: "typescript/No ternaries.md",
  id: "01JABCDE7XKQ2M9V3RTN8WPZ5F",
  statement: "No ternaries",
  type: "rule",
  score: 1,
  dontForget: true,
  needsFixing: true,
} as const

export function searchResponses(): SearchMemoryResult[] {
  return [
    {
      succeeded: true,
      output: {
        projectMissing: true,
        semantic: { mode: "text-only", problems: [] },
        vaults: [
          { vault: "global", hits: [hit], warnings: problems },
          { vault: "project", problems },
        ],
      },
    },
    {
      succeeded: true,
      output: {
        projectMissing: false,
        semantic: { mode: "text-only", problems: [] },
        vaults: [{ vault: "global", hits: [], warnings: [] }],
      },
    },
    { succeeded: true, output: { projectMissing: true, semantic: { mode: "text-only", problems: [] }, vaults: [] } },
    { succeeded: false, reason: "not-configured", problems, configPath: "config.json" },
    { succeeded: false, reason: "invalid-config", problems, configPath: "config.json" },
    { succeeded: false, reason: "cancelled", problems },
  ]
}

export function getResponses(): GetMemoryResult[] {
  return [
    { succeeded: true, output: { kind: "note", vault: "global", file: deliveredRead() } },
    {
      succeeded: true,
      output: {
        kind: "folder",
        vault: "global",
        text: "index text",
        path: "index.md",
        canonicalPath: "index.md",
        bytes: new Uint8Array(),
        rawHash: "hash",
        stat: { size: 1, mtimeMs: 1, ctimeMs: 1, device: 1, inode: 1 },
      },
    },
    { succeeded: false, reason: "unclosed-frontmatter", problems, file: deliveredRead() },
    { succeeded: false, reason: "no-project", problems, workingFolder: "work" },
    { succeeded: false, reason: "not-found", problems, path: "x.md", scope: "entry" },
    { succeeded: false, reason: "not-configured", problems, configPath: "config.json" },
  ]
}

export function blockTexts(): string[] {
  const note: LoadedDontForgetNote = { vault: "global", path: "Keep.md", type: "rule", body: "Body.", problems }
  const withNote: DontForgetVault[] = [{ vault: "global", notes: [note], problems }]
  const empty: DontForgetVault[] = [{ vault: "global", notes: [], problems: [] }]
  return [withNote, empty].map((vaults) => {
    const text = renderMemoryBlock({ succeeded: true, output: { vaults } })
    if (typeof text !== "string") throw new Error("no block")
    return text
  })
}

export function shippedSkillText(): string {
  return readFileSync(join(resolve(import.meta.dirname, "..", ".."), "skills", "obsidian-memory", "SKILL.md"), "utf8")
}

export function changeTexts(): string[] {
  const failures: ChangeFailure[] = [
    { succeeded: false, reason: "not-read", problems },
    { succeeded: false, reason: "stale-vault", problems },
    { succeeded: false, reason: "needs-fixing", problems },
    { succeeded: false, reason: "archived", problems },
    { succeeded: false, reason: "conflict", problems },
    { succeeded: false, reason: "exists", problems, existingStatement: "Use pnpm" },
    { succeeded: false, reason: "invalid", problems },
    { succeeded: false, reason: "stale-session", problems },
    { succeeded: false, reason: "not-configured", problems, configPath: "config.json" },
    { succeeded: false, reason: "partial", problems, published: ["archive/a.md"], originalState: "present" },
  ]
  return [
    ...failures.map((failure) => textOf(reportFailure(failure, "tools/Use pnpm.md"))),
    textOf(reportSuccess("Updated in global: tools/Use pnpm.md", problems)),
  ]
}

export function semanticTexts(): string[] {
  const problem = {
    provider: "local",
    model: "m",
    status: "model-not-downloaded",
    problem: "The local model is not downloaded yet (about 135 MB); it is asked for on the first semantic search",
  } as const
  const search = respondToSearch({
    succeeded: true,
    output: {
      projectMissing: false,
      semantic: {
        mode: "text-only",
        problems: [
          "Semantic search is off: the local search model is not downloaded and there is no UI to ask for the download; start pi with a UI once",
        ],
      },
      vaults: [{ vault: "global", hits: [], warnings: [] }],
    },
  })
  return [renderDoctorReport(diagnosedMemory({ embeddings: problem })), textOf(search)]
}
