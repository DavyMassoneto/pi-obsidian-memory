import { execFileSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import type { GitFlowConfig } from "#scripts"

export const CONFIG: GitFlowConfig = { main: "main", develop: "dev", releasePrefix: "release/", tagPrefix: "v" }

export const REPO_ROOT = join(import.meta.dirname, "..", "..")

const MACHINE_INDEPENDENT_GIT = [
  "-c",
  "user.name=Teste",
  "-c",
  "user.email=teste@example.com",
  "-c",
  "commit.gpgsign=false",
  "-c",
  "tag.gpgsign=false",
]

const created: string[] = []

export function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "release-test-"))
  created.push(dir)
  return dir
}

export function cleanupTempDirs(): void {
  for (const dir of created.splice(0)) rmSync(dir, { recursive: true, force: true })
}

export function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", [...MACHINE_INDEPENDENT_GIT, ...args], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim()
}

export function commit(cwd: string, message: string): void {
  git(cwd, "commit", "--allow-empty", "-q", "-m", message)
}

export function tag(cwd: string, name: string): void {
  git(cwd, "tag", "-a", name, "-m", name)
}

export function repoOnDevWithRemote(version = "0.1.0"): string {
  const remote = tempDir()
  git(remote, "init", "-q", "--bare", "-b", "main")
  const work = tempDir()
  git(work, "init", "-q", "-b", "main")
  git(work, "remote", "add", "origin", remote)
  writeFileSync(join(work, "package.json"), `${JSON.stringify({ name: "demo", version }, null, 2)}\n`)
  git(work, "add", "package.json")
  commit(work, "chore: início")
  git(work, "branch", "dev")
  git(work, "push", "-q", "origin", "main", "dev")
  git(work, "checkout", "-q", "dev")
  return work
}
