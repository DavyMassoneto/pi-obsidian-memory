import { localEmbeddingConfiguration, localEmbeddingPolicy } from "#src/domain"
import { EmbeddingResourceError } from "./errors.ts"
import type { ModelAssetFetchRequest } from "./types.ts"

export async function fetchPublicModelAsset(request: ModelAssetFetchRequest): Promise<Response> {
  const model = localEmbeddingConfiguration.model
  const revision = localEmbeddingPolicy.revision
  let url = new URL(`https://huggingface.co/${model}/resolve/${revision}/${request.path}`)
  for (let redirects = 0; redirects <= 5; redirects += 1) {
    request.signal.throwIfAborted()
    if (!allowedModelAssetUrl(url)) {
      break
    }
    const response = await fetch(url, { signal: request.signal, credentials: "omit", redirect: "manual" })
    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return response
    }
    await response.body?.cancel()
    const location = response.headers.get("location")
    if (!location) {
      break
    }
    url = new URL(location, url)
  }
  throw new EmbeddingResourceError({ succeeded: false, status: "unavailable" })
}

export function allowedModelAssetUrl(url: URL): boolean {
  if (url.protocol !== "https:" || url.port !== "" || url.username !== "" || url.password !== "") {
    return false
  }
  return [
    "huggingface.co",
    "cas-bridge.xethub.hf.co",
    "cdn-lfs.huggingface.co",
    "cdn-lfs-us-1.hf.co",
    "us.aws.cdn.hf.co",
  ].includes(url.hostname)
}
