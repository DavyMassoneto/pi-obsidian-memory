import type { NotifyLevel } from "#src/pi/context"
import { CONSOLIDATION_SAVED, CONSOLIDATOR_STARTED, OBSERVER_SAVED, OBSERVER_STARTED } from "./constants.ts"
import type { NoticeTarget, NoticeTimer } from "./types.ts"

export function tell(ctx: NoticeTarget, message: string, level: NotifyLevel): void {
  if (!ctx.hasUI) return
  try {
    ctx.ui.notify(message, level)
  } catch {
    return
  }
}

export function observerStartedNotice(chunks: number): string {
  return `${OBSERVER_STARTED} ${chunks} chunk(s).`
}

export function observerSavedNotice(observations: number): string {
  return `${OBSERVER_SAVED} ${observations} observation(s).`
}

export function consolidatorStartedNotice(observations: number, tokens: number): string {
  return `${CONSOLIDATOR_STARTED} ${observations} observation(s), about ${tokens} tokens.`
}

export function consolidatedNotice(observations: number, changes: number): string {
  return `${CONSOLIDATION_SAVED} ${observations} observation(s), ${changes} change(s) to the vaults.`
}

export class NoticeQueue {
  #lines: string[] = []
  #timer: NoticeTimer | null = null

  add(ctx: NoticeTarget, line: string): void {
    if (!ctx.hasUI) return
    this.#lines.push(line)
    if (this.#timer) return
    this.#timer = setTimeout(() => this.#flush(ctx), 0)
  }

  clear(): void {
    if (this.#timer) clearTimeout(this.#timer)
    this.#timer = null
    this.#lines = []
  }

  #flush(ctx: NoticeTarget): void {
    const lines = this.#lines
    this.#timer = null
    this.#lines = []
    if (lines.length > 0) tell(ctx, lines.join("\n"), "info")
  }
}
