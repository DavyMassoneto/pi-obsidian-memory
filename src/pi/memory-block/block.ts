import { STATUS_LOADING, withMemoryStatus } from "#src/pi/context"
import { trackDontForget } from "#src/usecases"
import { BLOCK_SEPARATOR, MEMORY_BLOCK_SECTION, RELEVANT_LOAD_ERROR_PREFIX } from "./constants.ts"
import { loadNotices, renderLoadFailure, renderLoadNotice, renderMemoryBlock } from "./render.ts"
import type { BeforeAgentStartHandler, BlockStart, DontForgetLoader } from "./types.ts"

export class MemoryBlock {
  #text: Promise<string | null> = Promise.resolve(null)
  #load: DontForgetLoader

  constructor(load: DontForgetLoader) {
    this.#load = load
  }

  begin(start: BlockStart): void {
    if (!start.configured) {
      this.clear()
      return
    }
    this.#text = withMemoryStatus(start.ctx, STATUS_LOADING, () => this.#loadBlock(start))
  }

  async #loadBlock(start: BlockStart): Promise<string | null> {
    const dontForget = this.#load(start.context).then(
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
    const [block, extra] = await Promise.all([
      dontForget,
      start.relevant().catch((error) => this.#relevantFailed(start, error)),
    ])
    return joined(block, extra)
  }

  #relevantFailed(start: BlockStart, error: Error | string): null {
    start.notify([`${RELEVANT_LOAD_ERROR_PREFIX} ${errorMessage(error)}`])
    return null
  }

  clear(): void {
    this.#text = Promise.resolve(null)
  }

  beforeAgentStart(): BeforeAgentStartHandler {
    return async (event) => {
      const text = await this.#text
      if (typeof text === "string") event.systemPromptOptions.sections[MEMORY_BLOCK_SECTION] = text
      return undefined
    }
  }
}

function joined(block: string | null, extra: string | null): string | null {
  if (typeof block !== "string") return null
  if (typeof extra !== "string") return block
  return [block, extra].join(BLOCK_SEPARATOR)
}

function errorMessage(error: Error | string): string {
  if (error instanceof Error) return error.message
  return String(error)
}
