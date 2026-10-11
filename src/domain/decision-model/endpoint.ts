export function isLoopbackEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint)
    if (url.protocol !== "http:" && url.protocol !== "https:") return false
    if (url.username || url.password || url.search || url.hash) return false
    if (url.pathname !== "/v1/systemone") return false
    return url.hostname === "127.0.0.1" || url.hostname === "[::1]"
  } catch {
    return false
  }
}
