import type { MemoryPiContext, NotifyLevel } from "#src/pi/context"

export function tell(ctx: MemoryPiContext, message: string, level: NotifyLevel): void {
  if (!ctx.hasUI) return
  try {
    ctx.ui.notify(message, level)
  } catch {
    return
  }
}
