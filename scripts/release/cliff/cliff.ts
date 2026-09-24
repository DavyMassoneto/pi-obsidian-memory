import { type Options as CliffOptions, runGitCliff } from "git-cliff"

import type { Bump } from "../index.ts"

export async function bumpedVersion(cwd: string, tagPrefix: string, bump: Bump): Promise<string> {
  const tag = await cliff(cwd, { bumpedVersion: true, bump })
  if (!tag.startsWith(tagPrefix)) throw new Error(`git-cliff returned "${tag}", without the tag prefix "${tagPrefix}"`)
  return tag.slice(tagPrefix.length)
}

export async function writeChangelog(cwd: string, tag: string): Promise<void> {
  await cliff(cwd, { tag, output: "CHANGELOG.md" })
}

export function previewChangelog(cwd: string, tag: string): Promise<string> {
  return cliff(cwd, { unreleased: true, tag, strip: "header" })
}

async function cliff(cwd: string, options: CliffOptions): Promise<string> {
  const result = await runGitCliff(options, { cwd, stdio: "pipe", reject: false })
  if (result.failed) throw cliffFailed(String(result.stderr).trim())
  return String(result.stdout).trim()
}

function cliffFailed(stderr: string): Error {
  if (stderr === "") return new Error("git-cliff failed without an error message")
  const lastLine = stderr.slice(stderr.lastIndexOf("\n") + 1).trim()
  return new Error(`git-cliff failed: ${lastLine}`)
}
