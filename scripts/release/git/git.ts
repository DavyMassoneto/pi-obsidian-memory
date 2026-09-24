import { type SpawnSyncReturns, spawnSync } from "node:child_process"

export function git(cwd: string, args: readonly string[]): string {
  const { error, status, stdout, stderr } = runGit(cwd, args)
  if (error) throw commandFailed("git", args, error.message)
  if (status !== 0) throw commandFailed("git", args, stderr.trim())
  return stdout.trim()
}

export function tryGit(cwd: string, args: readonly string[]): string | undefined {
  const { status, stdout } = runGit(cwd, args)
  return status === 0 ? stdout.trim() : undefined
}

export function runVisible(cwd: string, command: string, args: readonly string[]): void {
  const env = { ...process.env, GIT_MERGE_AUTOEDIT: "no" }
  const { error, status } = spawnSync(command, args, { cwd, env, stdio: "inherit" })
  if (error) throw commandFailed(command, args, error.message)
  if (status !== 0) throw commandFailed(command, args, `saiu com código ${status}`)
}

function runGit(cwd: string, args: readonly string[]): SpawnSyncReturns<string> {
  return spawnSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] })
}

function commandFailed(command: string, args: readonly string[], detail: string): Error {
  const line = [command, ...args].join(" ")
  return new Error(detail ? `${line} falhou: ${detail}` : `${line} falhou`)
}
