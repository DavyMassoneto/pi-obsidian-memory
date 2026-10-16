import type { EmbeddingConfiguration } from "#src/services"
import { checkLocalModel, localModelDownloadMegabytes } from "#src/usecases/semantic-provider"
import type { EmbeddingProbe, EmbeddingReport } from "./types.ts"

export async function checkEmbeddings(
  configuration: EmbeddingConfiguration,
  probe: EmbeddingProbe,
  signal: AbortSignal,
): Promise<EmbeddingReport> {
  const { provider, model } = configuration
  if (provider === "local") return checkLocal(configuration, probe, signal)
  if (await probe.hasCredentials(provider)) return { provider, model, status: "ready" }
  return { provider, model, status: "no-credentials", problem: `No API key for ${provider}` }
}

async function checkLocal(
  configuration: EmbeddingConfiguration,
  probe: EmbeddingProbe,
  signal: AbortSignal,
): Promise<EmbeddingReport> {
  const { provider, model } = configuration
  const status = await checkLocalModel(probe.modelCachePath, signal)
  if (status === "cached") return { provider, model, status: "ready" }
  if (status === "invalid") {
    return {
      provider,
      model,
      status: "model-damaged",
      problem: "The downloaded local model is damaged; remove its folder to download it again",
    }
  }
  const megabytes = localModelDownloadMegabytes()
  return {
    provider,
    model,
    status: "model-not-downloaded",
    problem: `The local model is not downloaded yet (about ${megabytes} MB); it is asked for on the first semantic search`,
  }
}
