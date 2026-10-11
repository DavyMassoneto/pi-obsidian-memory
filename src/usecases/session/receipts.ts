import type { MemoryScope, ParsedVaultNote } from "#/services"
import type { DeliveredRead, MemoryAddress } from "./types.ts"

export class GetReceipts {
  #vaults = new Map<MemoryScope, Map<string, DeliveredRead>>()

  remember(read: DeliveredRead): void {
    let paths = this.#vaults.get(read.vault)
    if (!paths) {
      paths = new Map<string, DeliveredRead>()
      this.#vaults.set(read.vault, paths)
    }
    paths.set(read.path, copyDeliveredRead(read))
  }

  get(address: MemoryAddress): DeliveredRead | null {
    const read = this.#vaults.get(address.vault)?.get(address.path)
    if (!read) return null
    return copyDeliveredRead(read)
  }

  consume(address: MemoryAddress): void {
    this.#vaults.get(address.vault)?.delete(address.path)
  }

  clear(): void {
    this.#vaults.clear()
  }
}

function copyDeliveredRead(read: DeliveredRead): DeliveredRead {
  let frontmatter: ParsedVaultNote["frontmatter"] = null
  if (read.analysis.frontmatter) frontmatter = { ...read.analysis.frontmatter }
  return {
    ...read,
    stat: { ...read.stat },
    analysis: {
      ...read.analysis,
      parsed: { ...read.analysis.parsed },
      frontmatter,
      frontmatterProblems: [...read.analysis.frontmatterProblems],
      nameProblems: [...read.analysis.nameProblems],
      bodyProblems: [...read.analysis.bodyProblems],
    },
  }
}
