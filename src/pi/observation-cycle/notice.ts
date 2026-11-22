import type { NotifyLevel } from "#src/pi/context"
import {
  CONSOLIDATION_SAVED,
  CONSOLIDATOR_CORRECTING,
  CONSOLIDATOR_STARTED,
  OBSERVER_SAVED,
  OBSERVER_STARTED,
  RECTIFIED_LEAD,
  UNCHECKED_LEAD,
  UNCHECKED_TAIL,
} from "./constants.ts"
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

export function consolidatorStartedNotice(observations: number, tokens: number, corrections: number): string {
  if (observations === 0 && corrections > 0) {
    return `${CONSOLIDATOR_STARTED} ${CONSOLIDATOR_CORRECTING} ${corrections} earlier observation(s) that were not the user's.`
  }
  return `${CONSOLIDATOR_STARTED} ${observations} observation(s), about ${tokens} tokens.`
}

export function consolidatedNotice(observations: number, changes: number): string {
  return `${CONSOLIDATION_SAVED} ${observations} observation(s), ${changes} change(s) to the vaults.`
}

export function rectifiedNotice(total: number, material: number, unconfirmed: number): string {
  const lines: string[] = []
  const checked = total - unconfirmed
  if (checked > 0) {
    lines.push(
      `${RECTIFIED_LEAD} ${checked} observation(s): ${material} came from material the assistant read, not from the user.`,
    )
  }
  if (unconfirmed > 0) lines.push(`${unconfirmed} observation(s) remain unconfirmed and are not saved as notes.`)
  return lines.join(" ")
}

export function uncheckedNotice(observations: number): string {
  return `${UNCHECKED_LEAD} ${observations} observation(s) ${UNCHECKED_TAIL}`
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
