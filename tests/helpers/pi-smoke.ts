import { DefaultResourceLoader, SettingsManager } from "@earendil-works/pi-coding-agent"

import { registrarFor } from "#src/pi"
import { useTempFolder } from "./temp-folder.ts"
import type { RegistrarSetup } from "./types.ts"

export async function loadWithRegistrar(register: RegistrarSetup) {
  const folder = await useTempFolder()
  const loader = new DefaultResourceLoader({
    cwd: folder,
    agentDir: folder,
    settingsManager: SettingsManager.inMemory(),
    extensionFactories: [(pi) => register(registrarFor(pi))],
    noExtensions: true,
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
    noContextFiles: true,
  })
  await loader.reload()
  const loaded = loader.getExtensions()
  if (loaded.errors.length > 0) throw new Error(loaded.errors.map((error) => error.error).join("\n"))
  const [extension] = loaded.extensions
  if (!extension) throw new Error("no extension loaded")
  return { tools: [...extension.tools.keys()], commands: [...extension.commands.keys()], handlers: extension.handlers }
}
