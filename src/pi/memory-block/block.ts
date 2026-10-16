import type { MemoryOperationContext } from "#src/usecases"
import { MEMORY_BLOCK_SECTION } from "./constants.ts"
import { renderLoadFailure, renderMemoryBlock } from "./render.ts"
import type { BeforeAgentStartHandler, DontForgetLoader } from "./types.ts"

export class MemoryBlock {
  #text: Promise<string | null> = Promise.resolve(null)
  #load: DontForgetLoader

  constructor(load: DontForgetLoader) {
    this.#load = load
  }

  begin(context: MemoryOperationContext, configured: boolean): void {
    if (!configured) {
      this.clear()
      return
    }
    this.#text = this.#load(context).then(renderMemoryBlock, describeLoadError)
  }

  clear(): void {
    this.#text = Promise.resolve(null)
  }

  beforeAgentStart(): BeforeAgentStartHandler {
    return async (event) => {
      const text = await this.#text
      if (typeof text === "string") event.systemPromptOptions.sections[MEMORY_BLOCK_SECTION] = text
    }
  }
}

function describeLoadError(error: Error | string): string {
  if (error instanceof Error) return renderLoadFailure(error.message)
  return renderLoadFailure(String(error))
}
