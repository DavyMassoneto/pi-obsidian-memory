import type { OriginMaterialItem } from "#src/domain/observation-ledger/origin"
import type { WorkStateChange, WorkStateItem } from "./types.ts"

export function applyWorkState(
  previous: WorkStateItem[],
  changes: WorkStateChange[],
  material: OriginMaterialItem[],
  corrections: OriginMaterialItem[],
): WorkStateItem[] {
  const sources = new Set(material.map((item) => item.label))
  const corrected = new Map(corrections.map((item) => [item.label, item.text]))
  const replaced = new Set<number>()
  const added: WorkStateItem[] = []
  for (const { sourceId, text, replaces } of changes) {
    const isCorrection = corrected.has(sourceId)
    if (!isCorrection && !sources.has(sourceId)) continue
    if (isCorrection && (typeof text !== "string" || replaces.length === 0)) continue
    if (
      !replaces.every((index) => {
        const item = previous[index]
        if (!item || replaced.has(index)) return false
        if (isCorrection) return item.sourceId === sourceId
        return item.sourceId < sourceId
      })
    )
      continue
    for (const index of replaces) replaced.add(index)
    if (typeof text === "string") added.push({ sourceId, text })
  }
  const kept = previous.flatMap((item, index) => {
    if (replaced.has(index)) return []
    const correction = corrected.get(item.sourceId)
    if (typeof correction === "string") return [{ sourceId: item.sourceId, text: correction }]
    return [item]
  })
  const seen = new Set<string>()
  return [...kept, ...added].filter((item) => {
    const key = `${item.sourceId} ${item.text}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
