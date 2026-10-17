import { type ChildProcess, execFile, execFileSync, spawn } from "node:child_process"
import { createServer } from "node:net"
import { dirname, join } from "node:path"
import { setTimeout as sleep } from "node:timers/promises"

import { onTestFinished } from "vitest"

import { repoRoot } from "./e2e-paths.ts"

export interface LayaServer {
  endpoint: string
}

export interface LayaSettings {
  jevStrict: boolean
  maxTokenBudget: number | null
  apiKey: string | null
}

export const LAYA_DEFAULTS: LayaSettings = { jevStrict: false, maxTokenBudget: null, apiKey: null }

interface LayaLog {
  text: string
}

export function layaServePath(): string {
  const args = ["rev-parse", "--path-format=absolute", "--git-common-dir"]
  const common = execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim()
  return join(dirname(common), "tmp", "laya-venv", "Scripts", "laya-serve.exe")
}

export async function startLaya(settings: LayaSettings): Promise<LayaServer> {
  const port = await freePort()
  const env: NodeJS.ProcessEnv = { ...process.env, LAYA_HOST: "127.0.0.1", LAYA_PORT: String(port) }
  delete env.LAYA_JEV_STRICT
  delete env.LAYA_MAX_TOKEN_BUDGET
  delete env.LAYA_API_KEY
  if (settings.jevStrict) env.LAYA_JEV_STRICT = "1"
  if (typeof settings.apiKey === "string") env.LAYA_API_KEY = settings.apiKey
  if (typeof settings.maxTokenBudget === "number") env.LAYA_MAX_TOKEN_BUDGET = String(settings.maxTokenBudget)
  const child = spawn(layaServePath(), [], { env, stdio: ["ignore", "ignore", "pipe"] })
  const log: LayaLog = { text: "" }
  child.stderr.setEncoding("utf8")
  child.stderr.on("data", (chunk: string) => {
    log.text += chunk
  })
  onTestFinished(() => stopLaya(child))
  const base = `http://127.0.0.1:${port}`
  await waitHealthy(base, child, log)
  return { endpoint: `${base}/v1/systemone` }
}

export async function freePort(): Promise<number> {
  const server = createServer()
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()))
  const address = server.address()
  await new Promise<void>((resolve) => server.close(() => resolve()))
  if (!address || typeof address === "string") throw new Error("no free port")
  return address.port
}

async function waitHealthy(base: string, child: ChildProcess, log: LayaLog): Promise<void> {
  for (;;) {
    if (typeof child.exitCode === "number") throw new Error(`laya-serve exited ${child.exitCode}: ${log.text}`)
    const healthy = await fetch(`${base}/health`).then(
      (response) => response.ok,
      () => false,
    )
    if (healthy) return
    await sleep(1000)
  }
}

async function stopLaya(child: ChildProcess): Promise<void> {
  if (typeof child.exitCode === "number") return
  const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()))
  if (typeof child.pid === "number") execFile("taskkill", ["/PID", String(child.pid), "/T", "/F"])
  await exited
}
