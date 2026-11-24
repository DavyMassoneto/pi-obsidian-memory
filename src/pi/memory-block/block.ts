import { STATUS_LOADING, withMemoryStatus } from "#src/pi/context"
import { trackDontForget } from "#src/usecases"
import { MEMORY_BLOCK_SECTION, RELEVANT_LOAD_ERROR_PREFIX } from "./constants.ts"
import { loadNotices, renderLoadFailure, renderLoadNotice, renderMemoryBlock } from "./render.ts"
import type { BeforeAgentStartHandler, BlockStart, DontForgetLoader } from "./types.ts"

export class MemoryBlock {
  #text: Promise<string | null> = Promise.resolve(null)
  #settled: Promise<void> = Promise.resolve()
  #load: DontForgetLoader

  constructor(load: DontForgetLoader) {
    this.#load = load
  }

  begin(start: BlockStart): void {
    if (!start.configured) {
      this.clear()
      return
    }
    this.#text = this.#loadBlock(start)
    const dontForget = this.#text
    this.#settled = withMemoryStatus(start.ctx, STATUS_LOADING, async () => {
      await Promise.all([dontForget, start.relevant().catch((error) => this.#relevantFailed(start, error))])
    })
  }

  async #loadBlock(start: BlockStart): Promise<string | null> {
    return this.#load(start.context).then(
      (result) => {
        trackDontForget(start.loaded, result)
        start.notify(loadNotices(result))
        return renderMemoryBlock(result)
      },
      (error) => {
        start.notify([renderLoadNotice(errorMessage(error))])
        return renderLoadFailure(errorMessage(error))
      },
    )
  }

  #relevantFailed(start: BlockStart, error: Error | string): null {
    start.notify([`${RELEVANT_LOAD_ERROR_PREFIX} ${errorMessage(error)}`])
    return null
  }

  async settled(): Promise<void> {
    await this.#settled.then(noop, noop)
  }

  clear(): void {
    this.#text = Promise.resolve(null)
    this.#settled = Promise.resolve()
  }

  beforeAgentStart(): BeforeAgentStartHandler {
    return async (event) => {
      const text = await this.#text
      if (typeof text === "string") event.systemPromptOptions.sections[MEMORY_BLOCK_SECTION] = text
      return undefined
    }
  }
}

function noop(): void {}

function errorMessage(error: Error | string): string {
  if (error instanceof Error) return error.message
  return String(error)
}
