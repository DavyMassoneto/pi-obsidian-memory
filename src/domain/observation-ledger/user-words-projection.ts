import type { UserPassage, UserWords } from "#src/domain/observation-ledger/origin"
import { USER_WORDS_ID_SUFFIX, USER_WORDS_SUPPLEMENT_SUFFIX } from "./constants.ts"
import { rectificationKey } from "./rectify.ts"
import { textTokens } from "./tokens.ts"
import type { LedgerObservation } from "./types.ts"

export class UserWordsProjection {
  #used: Set<string>
  #seen = new Set<string>()
  #overflow = 0

  constructor(used: Set<string>) {
    this.#used = used
  }

  from(localTime: string, words: UserWords, shortText: string | null): LedgerObservation[] {
    const lines: LedgerObservation[] = []
    for (const [index, passage] of words.passages.entries()) {
      const suffix = USER_WORDS_ID_SUFFIX + String(index).padStart(2, "0")
      this.#keep(lines, localTime, suffix, words.entryId, passage)
    }
    if (typeof shortText === "string" && !words.passages.some((passage) => passage.quote === shortText)) {
      this.#keep(lines, localTime, USER_WORDS_SUPPLEMENT_SUFFIX, words.entryId, { kind: "message", quote: shortText })
    }
    return lines
  }

  #keep(lines: LedgerObservation[], time: string, suffix: string, entryId: string, passage: UserPassage): void {
    let id = time + suffix
    const sourceSlot = rectificationKey(entryId, id)
    if (this.#seen.has(sourceSlot)) return
    this.#seen.add(sourceSlot)
    while (this.#used.has(id)) id = time + USER_WORDS_SUPPLEMENT_SUFFIX + String(++this.#overflow)
    this.#used.add(id)
    const content = `User wrote (${passage.kind}): "${passage.quote}"`
    lines.push({ id, content, tokens: textTokens(content), origin: "user", sources: [entryId] })
  }
}
