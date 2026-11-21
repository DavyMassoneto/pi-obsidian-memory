import { join } from "node:path"

import {
  createAgentSession,
  DefaultResourceLoader,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent"
import { onTestFinished } from "vitest"

import {
  compactionLoadedHandler,
  MemorySessionKeeper,
  ObservationRuntime,
  observationCompactionHandler,
  registryCompletion,
} from "#src/pi"
import { nativePiModels } from "./native-pi-models.ts"
import { useTempFolder } from "./temp-folder.ts"

export async function nativeObservationSession(sessionFile: string | undefined, keepRecentTokens: number) {
  const root = await useTempFolder()
  const { runtime, registry, model } = await nativePiModels()
  const selected = registry.find(model.provider, model.id)
  if (!selected) throw new Error("The selected native model is missing")
  const settings = SettingsManager.inMemory({ compaction: { keepRecentTokens } })
  const observed: ObservationRuntime[] = []
  const loader = observationLoader(root, settings, observed, model)
  await loader.reload()
  const errors = loader.getExtensions().errors
  if (errors.length > 0) throw new Error(errors.map((error) => error.error).join("; "))
  const created = await createAgentSession({
    cwd: root,
    agentDir: root,
    model: selected,
    modelRuntime: runtime,
    settingsManager: settings,
    sessionManager: observationSessionManager(root, sessionFile),
    resourceLoader: loader,
    tools: [],
  })
  await created.session.bindExtensions({})
  return finishFixture(root, created.session, observed)
}

function observationSessionManager(root: string, path: string | undefined): SessionManager {
  if (path) return SessionManager.open(path, join(root, "sessions"), root)
  return SessionManager.create(root, join(root, "sessions"))
}

function observationLoader(
  root: string,
  settings: SettingsManager,
  observed: ObservationRuntime[],
  model: Awaited<ReturnType<typeof nativePiModels>>["model"],
): DefaultResourceLoader {
  return new DefaultResourceLoader({
    cwd: root,
    agentDir: root,
    settingsManager: settings,
    noExtensions: true,
    noSkills: true,
    noThemes: true,
    noPromptTemplates: true,
    noContextFiles: true,
    extensionFactories: [
      (pi) => {
        const observer = new ObservationRuntime({
          completionOf: registryCompletion,
          writeCommit: (data) => pi.appendEntry("memory.observations", data),
        })
        observed.push(observer)
        const sessions = new MemorySessionKeeper()
        const paths = { configPath: join(root, "memory.json"), indexPath: join(root, "memory-index") }
        pi.on("session_before_compact", observationCompactionHandler({ observer, paths, sessions }))
        pi.on("session_compact", compactionLoadedHandler({ sessions }))
        pi.on("turn_end", async (_event, ctx) => {
          await observer.flush(ctx, model, { chunkTokens: 1000, chunkOverlapTokens: 0, observerConcurrency: 1 })
        })
        pi.on("session_shutdown", () => observer.close())
      },
    ],
  })
}

function finishFixture(
  root: string,
  session: Awaited<ReturnType<typeof createAgentSession>>["session"],
  observed: ObservationRuntime[],
) {
  const observer = observed[0]
  if (!observer) throw new Error("The observer extension was not loaded")
  onTestFinished(async () => {
    await observer.close()
    session.dispose()
  })
  return { root, session, observer }
}
