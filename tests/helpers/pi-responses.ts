import type { GetMemoryResult, SearchMemoryResult } from "#src/usecases"
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
