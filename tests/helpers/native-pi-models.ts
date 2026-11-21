import { getAgentDir, ModelRegistry, ModelRuntime, SettingsManager } from "@earendil-works/pi-coding-agent"

export async function nativePiModels() {
  const agentDir = getAgentDir()
  const settings = SettingsManager.create(agentDir, agentDir)
  const provider = settings.getDefaultProvider()
  const id = settings.getDefaultModel()
  if (!provider || !id) throw new Error("The pi profile must have a selected model")
  const runtime = await ModelRuntime.create()
  const registry = new ModelRegistry(runtime)
  const model = registry.find(provider, id)
  if (!model) throw new Error(`The selected pi model is not registered: ${provider}/${id}`)
  return { runtime, registry, model: { provider, id } }
}
