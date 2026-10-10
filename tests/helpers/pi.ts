import { spawn } from "node:child_process"
import { once } from "node:events"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

import { type MemoryAddResponse, type MemoryAddTool, registerExtension } from "#/pi"
import type { PiRun } from "./types.ts"

const repoRoot = resolve(import.meta.dirname, "..", "..")
const piCli = join(repoRoot, "node_modules", "@earendil-works", "pi-coding-agent", "dist", "cli.js")
const killPiBeforeVitestTimeoutMs = 20_000

export async function withIsolatedPi(run: PiRun): Promise<void> {
  const isolatedAgentDir = await mkdtemp(join(tmpdir(), "pi-smoke-"))
  const pi = spawn(
    process.execPath,
    [piCli, "--mode", "rpc", "--no-session", "--offline", "--no-extensions", "-e", repoRoot],
    {
      cwd: isolatedAgentDir,
      env: { ...process.env, PI_CODING_AGENT_DIR: isolatedAgentDir },
      timeout: killPiBeforeVitestTimeoutMs,
    },
  )
  const exited = once(pi, "exit")
  try {
    await run(pi)
  } finally {
    pi.kill()
    await exited
    await rm(isolatedAgentDir, { recursive: true, force: true })
  }
}

export function registerWithFakePi(env: NodeJS.ProcessEnv) {
  const tools: MemoryAddTool[] = []
  const events: string[] = []

  registerExtension(
    { registerTool: (tool) => tools.push(tool), on: (event) => events.push(event) },
    join("C:", "agent"),
    env,
  )

  return { tools, events }
}

export function textOf(response: MemoryAddResponse): string {
  const texts = response.content.flatMap((part) => {
    if (part.type === "text") {
      return [part.text]
    }

    return []
  })

  return texts.join("")
}
