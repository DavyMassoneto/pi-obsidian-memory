import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"

import { SessionManager } from "@earendil-works/pi-coding-agent"
import { onTestFinished } from "vitest"

import { DEFAULT_COMPACTION, DEFAULT_CONSOLIDATOR, DEFAULT_OBSERVER, type StoredObservation } from "#src/domain"
import { memoryConfigPath, recordsOf, STATUS_LOADING } from "#src/pi"
import { ensureVaultAssets, type MemoryConfig } from "#src/services"
import { localTimestamp, OBSERVATIONS_TYPE, type SessionRecord, textTokens } from "#src/usecases"
import { piCredentialsEnv } from "./e2e-credentials.ts"
import { writeOmnirouteWorld } from "./e2e-omniroute.ts"
import { E2E_MODEL, E2E_PROVIDER, piCliPath } from "./e2e-paths.ts"
import { NotifySchema, notifySettles, recordOf } from "./e2e-records.ts"
import { RpcPi } from "./e2e-rpc.ts"
import { statusCleared } from "./e2e-turns.ts"
import { piArgs } from "./e2e-world.ts"

const TEST_MODEL = { provider: E2E_PROVIDER, id: E2E_MODEL }
const UNREGISTERED_VERIFIER = { provider: E2E_PROVIDER, id: "unregistered-verifier-for-exhaustion-test" }

interface NoticeSeed {
  file: string
  source: string
  sourceRecord: string
  observations: StoredObservation[]
}

interface InconclusiveWorld extends NoticeSeed {
  pi: RpcPi
  vault: string
  config: MemoryConfig
  saveConfig(): Promise<void>
  history(): SessionRecord[]
}

function noticeConfig(vault: string): MemoryConfig {
  return {
    global: { vault },
    projects: [],
    limits: { maxBodyChars: 1000, maxStatementChars: 100 },
    observer: { ...DEFAULT_OBSERVER, concurrency: 1, model: UNREGISTERED_VERIFIER },
    compaction: { ...DEFAULT_COMPACTION, tailTokens: 1 },
    consolidator: { ...DEFAULT_CONSOLIDATOR, poolTargetTokens: 1, thinking: "low", model: TEST_MODEL },
    memoryAgent: { model: TEST_MODEL },
    context: { budgetChars: 12000 },
    embeddings: { provider: "local", model: "Xenova/multilingual-e5-small" },
    decisionModel: { provider: "typesafe", model: "jev-latest" },
  }
}

async function writeProfile(agentDir: string, config: MemoryConfig): Promise<void> {
  const configPath = memoryConfigPath(agentDir)
  await mkdir(dirname(configPath), { recursive: true })
  await writeFile(configPath, JSON.stringify(config))
  await writeFile(join(agentDir, "settings.json"), JSON.stringify({ compaction: { keepRecentTokens: 1 } }))
  await writeOmnirouteWorld(agentDir)
}

function seedUnverifiedObservations(cwd: string, sessionDir: string): NoticeSeed {
  const session = SessionManager.create(cwd, sessionDir)
  session.appendModelChange(E2E_PROVIDER, E2E_MODEL)
  const now = Date.now()
  const source = session.appendMessage({ role: "user", content: "This is a temporary QA session.", timestamp: now })
  const when = localTimestamp(now)
  const observations = Array.from({ length: 6 }, (_, index) => {
    const content = `User reportedly requires the fictional label nickel-${index + 10}.`
    return { id: `${when}.0${index + 1}`, content, tokens: textTokens(content) }
  })
  const sourceRecord = session.appendCustomEntry(OBSERVATIONS_TYPE, {
    fromId: source,
    coversUpToId: source,
    observations,
  })
  const file = session.getSessionFile()
  if (!file) throw new Error("the fixture session was not persisted")
  return { file, source, sourceRecord, observations }
}

function startNoticePi(cwd: string, agentDir: string, file: string): RpcPi {
  const args = piArgs({ memory: "configured", modelCache: "fresh", session: "saved", tools: [] })
  return new RpcPi({
    cwd,
    agentDir,
    credentials: piCredentialsEnv(),
    offlineNpmCache: null,
    omitTypesafeKey: false,
    args: [...args, "--no-tools", "--session", file, "--thinking", "low"],
  })
}

export async function inconclusiveNoticeWorld(): Promise<InconclusiveWorld> {
  const root = await mkdtemp(join(tmpdir(), "pi-memory-inconclusive-"))
  let pi: RpcPi | null = null
  onTestFinished(async () => {
    try {
      await pi?.stop()
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
  const agentDir = join(root, "agent")
  const cwd = join(root, "work")
  const vault = join(root, "vault")
  const config = noticeConfig(vault)
  await mkdir(cwd)
  const assets = await ensureVaultAssets({ path: vault, name: "global", limits: config.limits })
  if (!assets.succeeded) throw new Error(assets.problems.join("; "))
  await writeProfile(agentDir, config)
  const seed = seedUnverifiedObservations(cwd, join(root, "sessions"))
  pi = startNoticePi(cwd, agentDir, seed.file)
  await pi.waitFor(statusCleared(STATUS_LOADING.key), 0)
  const saveConfig = () => writeFile(memoryConfigPath(agentDir), JSON.stringify(config))
  const history = () => recordsOf(SessionManager.open(seed.file).getBranch())
  return { ...seed, pi, vault, config, saveConfig, history }
}

export async function retryNoticeSession(pi: RpcPi, file: string): Promise<void> {
  const from = pi.lines.length
  await pi.switchSession(file)
  await pi.waitFor(statusCleared(STATUS_LOADING.key), from)
}

export async function noticeFrom(pi: RpcPi, prefixes: string[], from: number) {
  const rpc = await pi.waitFor(notifySettles(prefixes), from)
  return recordOf(NotifySchema, rpc)
}

export function noticeChatRuns(file: string) {
  const session = SessionManager.open(file)
  const runs = session.getBranch().flatMap((entry) => {
    if (entry.type !== "message" || entry.message.role !== "assistant") return []
    const { api, provider, model, stopReason } = entry.message
    return [{ api, provider, model, stopReason }]
  })
  return { session: session.getSessionId(), runs }
}

export async function noticePiVersion(): Promise<string> {
  const data = JSON.parse(await readFile(join(dirname(piCliPath()), "..", "..", "package.json"), "utf8"))
  if (typeof data?.version !== "string") throw new Error("the Pi test dependency has no version")
  return data.version
}
