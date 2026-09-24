import { type Options as CliffOptions, runGitCliff } from "git-cliff"

import type { Bump } from "../index.ts"

export async function bumpedVersion(cwd: string, bump: Bump, tagPrefix: string): Promise<string> {
  const printed = await cliff(cwd, { bumpedVersion: true, ...(bump === "auto" ? {} : { bump }) })
  return printed.startsWith(tagPrefix) ? printed.slice(tagPrefix.length) : printed
}

export async function writeChangelog(cwd: string, tag: string): Promise<void> {
  await cliff(cwd, { tag, output: "CHANGELOG.md" })
}

export function previewChangelog(cwd: string, tag: string): Promise<string> {
  return cliff(cwd, { unreleased: true, tag, strip: "header" })
}

async function cliff(cwd: string, options: CliffOptions): Promise<string> {
  const result = await runGitCliff(options, { cwd, stdio: "pipe", reject: false })
  if (result.failed) throw new Error(`git-cliff falhou: ${lastLine(String(result.stderr))}`)
  return String(result.stdout).trim()
}

function lastLine(text: string): string {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "")
  return lines.at(-1)?.trim() ?? "sem detalhes"
}
