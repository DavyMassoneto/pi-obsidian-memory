import { createServer } from "node:http"

import { onTestFinished } from "vitest"

export const DOWNLOAD_SOURCE_PLACEHOLDER = "http://127.0.0.1:0"

const DOWNLOAD_SOURCE_TEXT = "<html>downloaded</html>\n"

export async function startDownloadSource(): Promise<string> {
  const server = createServer((_request, response) => response.end(DOWNLOAD_SOURCE_TEXT))
  const listening = Promise.withResolvers<void>()
  const errors: Error[] = []
  server.on("error", (error) => {
    errors.push(error)
    listening.reject(error)
  })
  server.listen(0, "127.0.0.1", () => listening.resolve())
  await listening.promise
  onTestFinished(() => {
    server.close()
    server.closeAllConnections()
    if (errors.length > 0) throw errors[0]
  })
  const address = server.address()
  if (!address || typeof address === "string") throw new Error("the download source has no port")
  return `http://127.0.0.1:${address.port}`
}

export function withDownloadSource(command: string, sourceUrl: string): string {
  return command.replaceAll(DOWNLOAD_SOURCE_PLACEHOLDER, sourceUrl)
}
