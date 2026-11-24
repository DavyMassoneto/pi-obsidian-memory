import { spawn } from "node:child_process"
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createInterface } from "node:readline"

import { onTestFinished } from "vitest"

import { type PiCredentialsEnv, piCredentialsEnv } from "./e2e-credentials.ts"
import { E2E_MODEL, E2E_PROVIDER, extensionPath } from "./e2e-paths.ts"

export const webProvider = E2E_PROVIDER
export const webModel = E2E_MODEL
const profile = [
  "---",
  "description: Follow the file chain and return its receipt",
  "tools: [read]",
  "load_skills: false",
  "load_extensions: true",
  "codemode: off",
  "mcp: off",
  "inherit_context: false",
  "run_in_background: true",
  "persist_session: true",
  "---",
  "Follow the delegated task carefully. A context compaction is not the end of the task.",
].join("\n")

async function configuration(root: string, agent: string, cwd: string, credentials: PiCredentialsEnv) {
  const baseUrl = `${credentials.OMNIROUTE_URL.trim().replace(/\/+$/, "").replace(/\/v1$/, "")}/v1`
  const globalVault = join(root, "global-vault")
  const projectVault = join(root, "project-vault")
  const memory = join(agent, "pi-obsidian-memory")
  await Promise.all([mkdir(globalVault), mkdir(projectVault), mkdir(memory), mkdir(join(agent, "agents"))])
  const modelRef = { provider: webProvider, id: webModel }
  await Promise.all([
    writeFile(join(agent, "agents", "e2e-compact.md"), profile),
    writeFile(join(agent, "agents", "settings.json"), JSON.stringify({ builtInEnabled: true })),
    writeFile(
      join(agent, "settings.json"),
      JSON.stringify({
        extensions: [extensionPath()],
        compaction: { enabled: false, keepRecentTokens: 1 },
        retry: { enabled: false },
      }),
    ),
    writeFile(
      join(agent, "models.json"),
      JSON.stringify({
        providers: {
          [webProvider]: {
            baseUrl,
            api: "openai-responses",
            authHeader: true,
            apiKey: "$OMNIROUTE_API_KEY",
            compat: {
              sessionAffinityFormat: "openrouter",
              promptCacheSessionHeader: "x-session-id",
              supportsLongCacheRetention: true,
            },
            models: [{ id: webModel }],
          },
        },
      }),
    ),
    writeFile(
      join(memory, "config.json"),
      JSON.stringify({
        global: { vault: globalVault },
        projects: [{ name: "e2e", folder: cwd, vault: projectVault }],
        limits: { maxBodyChars: 1000, maxStatementChars: 100 },
        observer: { model: modelRef, thinking: "low", chunkTokens: 300, concurrency: 4 },
        compaction: { atContextTokens: 1, tailTokens: 200, mapTokens: 2000 },
        consolidator: {
          model: modelRef,
          thinking: "low",
          atPoolTokens: 15000,
          poolTargetTokens: 10000,
          journeyTokens: 1000,
        },
        memoryAgent: { model: modelRef },
        context: { budgetChars: 12000 },
        embeddings: { provider: "local", model: "Xenova/multilingual-e5-small" },
        decisionModel: { provider: "typesafe", model: "jev-latest" },
      }),
    ),
  ])
}

function serverEnvironment(root: string, agent: string, credentials: PiCredentialsEnv): NodeJS.ProcessEnv {
  const env = { ...process.env }
  for (const name of Object.keys(env))
    if (/^(PI_|OMNIROUTE_|TYPESAFE_)|API_KEY|AUTH_TOKEN|OAUTH_TOKEN/.test(name)) delete env[name]
  return {
    ...env,
    PI_CODING_AGENT_DIR: agent,
    PI_CODING_AGENT_SESSION_DIR: join(root, "sessions"),
    PI_WEB_SKIP_VERSION_CHECK: "1",
    PI_SKIP_VERSION_CHECK: "1",
    HOME: root,
    USERPROFILE: root,
    APPDATA: join(root, "appdata"),
    LOCALAPPDATA: join(root, "localappdata"),
    XDG_CACHE_HOME: join(root, "cache"),
    XDG_CONFIG_HOME: join(root, "config"),
    XDG_DATA_HOME: join(root, "data"),
    HF_HOME: join(root, "huggingface"),
    OMNIROUTE_API_KEY: credentials.OMNIROUTE_API_KEY,
    TYPESAFE_API_KEY: credentials.TYPESAFE_API_KEY,
  }
}

type RunWorld<T> = (base: string, cwd: string, isolatedRoot: string) => Promise<T>
type RunServer<T> = (base: string) => Promise<T>
type StopServer = () => Promise<void>

export async function withPiWeb<T>(run: RunWorld<T>): Promise<T> {
  const credentials = piCredentialsEnv()
  let temp = tmpdir()
  if (process.env.RUNNER_TEMP) temp = process.env.RUNNER_TEMP
  const installation = join(temp, "pi-web-memory-e2e-install", "node_modules", "@agegr", "pi-web")
  const root = await mkdtemp(join(temp, "pi-web-memory-e2e-"))
  const agent = join(root, "agent")
  const cwd = join(root, "project")
  const sessions = join(root, "sessions")
  let stop: StopServer | undefined
  onTestFinished(async () => {
    await stop?.()
    await rm(root, { recursive: true, force: true })
  })
  await Promise.all([mkdir(agent), mkdir(cwd), mkdir(sessions)])
  await configuration(root, agent, cwd, credentials)
  const env = serverEnvironment(root, agent, credentials)
  return runServer(
    installation,
    env,
    (base) => run(base, cwd, root),
    (shutdown) => {
      stop = shutdown
    },
  )
}

type RegisterStop = (stop: StopServer) => void

async function runServer<T>(
  installation: string,
  env: NodeJS.ProcessEnv,
  run: RunServer<T>,
  registerStop: RegisterStop,
): Promise<T> {
  const next = join(installation, "..", "..", "next", "dist", "bin", "next")
  try {
    await access(join(installation, ".next", "BUILD_ID"))
    await access(next)
  } catch {
    throw new Error(`Missing isolated Pi Web 0.18.0 installation at ${installation}`)
  }
  const server = spawn(process.execPath, [next, "start", "-p", "0", "-H", "127.0.0.1"], {
    cwd: installation,
    env,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  })
  const closed = new Promise<void>((resolve) => server.once("close", () => resolve()))
  server.stderr.resume()
  const lines = createInterface({ input: server.stdout })
  registerStop(async () => {
    lines.close()
    server.kill()
    await closed
  })
  const base = await new Promise<string>((resolve, reject) => {
    let url = ""
    lines.on("line", (line) => {
      const match = line.match(/http:\/\/(?:localhost|127\.0\.0\.1):(\d+)/)
      if (match) url = `http://127.0.0.1:${match[1]}`
      if (line.includes("Ready") && url) resolve(url)
    })
    server.once("error", reject)
    server.once("close", (code) => reject(new Error(`Isolated Pi Web exited before readiness (${code})`)))
  })
  return run(base)
}
