import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent"

export default function extension(pi: ExtensionAPI): void {
  pi.on("session_start", handleSessionStart)
}

function handleSessionStart(_event: object, ctx: ExtensionContext): void {
  ctx.ui.notify("pi-obsidian-memory loaded", "info")
}
