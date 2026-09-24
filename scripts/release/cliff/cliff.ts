import { type Options as CliffOptions, runGitCliff } from "git-cliff"

import type { Bump } from "../index.ts"

export function calculatedVersion(cwd: string, tagPrefix: string): Promise<string> {
  return versionFromCliff(cwd, tagPrefix, { bumpedVersion: true })
}

export function forcedVersion(cwd: string, tagPrefix: string, bump: Bump): Promise<string> {
  return versionFromCliff(cwd, tagPrefix, { bumpedVersion: true, bump })
}

export async function writeChangelog(cwd: string, tag: string): Promise<void> {
  await cliff(cwd, { tag, output: "CHANGELOG.md" })
}

export function previewChangelog(cwd: string, tag: string): Promise<string> {
  return cliff(cwd, { unreleased: true, tag, strip: "header" })
}

async function versionFromCliff(cwd: string, tagPrefix: string, options: CliffOptions): Promise<string> {
  const tag = await cliff(cwd, options)
  if (!tag.startsWith(tagPrefix)) throw new Error(`o git-cliff devolveu "${tag}", sem o prefixo de tag "${tagPrefix}"`)
  return tag.slice(tagPrefix.length)
}

async function cliff(cwd: string, options: CliffOptions): Promise<string> {
  const result = await runGitCliff(options, { cwd, stdio: "pipe", reject: false })
  if (result.failed) throw cliffFailed(String(result.stderr))
  return String(result.stdout).trim()
}

function cliffFailed(stderr: string): Error {
  const lines = stderr.split(/\r?\n/).filter((line) => line.trim() !== "")
  const reason = lines.at(-1)
  if (reason === undefined) return new Error("git-cliff falhou sem mensagem de erro")
  return new Error(`git-cliff falhou: ${reason.trim()}`)
}
