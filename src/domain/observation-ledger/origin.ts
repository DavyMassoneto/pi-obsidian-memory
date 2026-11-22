import type { OriginMaterialItem } from "#src/domain/observation-ledger/origin"
import { CORRECTION_LEAD, DURABLE_ORIGINS, ORIGIN_MARKS, USER_WORDS_GAP, USER_WORDS_LEAD } from "./constants.ts"
import type { LedgerObservation, SavedNote } from "./types.ts"

function userWordsOf(observation: LedgerObservation): string | null {
  if (observation.origin !== "partial" || !observation.userWords || observation.userWords.length === 0) return null
  const quoted = observation.userWords.map((words) => `"${words}"`).join(USER_WORDS_GAP)
  return `${USER_WORDS_LEAD} ${quoted}.`
}

export function presentedContent(observation: LedgerObservation): string {
  const userWords = userWordsOf(observation)
  if (typeof userWords === "string") return `${userWords} ${ORIGIN_MARKS.unconfirmed} ${observation.content}`
  if (observation.origin === "partial") return `${ORIGIN_MARKS.unconfirmed} ${observation.content}`
  if (observation.origin === "unverified") return `${ORIGIN_MARKS.unverified} ${observation.content}`
  if (observation.origin === "restated") return `${ORIGIN_MARKS.restated} ${observation.content}`
  if (observation.origin === "unconfirmed") return `${ORIGIN_MARKS.unconfirmed} ${observation.content}`
  if (observation.origin === "material") return `${ORIGIN_MARKS.material} ${observation.content}`
  return observation.content
}

export function journeyMaterial(observations: LedgerObservation[]): OriginMaterialItem[] {
  return observations.map((observation) => ({ label: observation.id, text: presentedContent(observation) }))
}

export function captureMaterial(observations: LedgerObservation[]): OriginMaterialItem[] {
  const material: OriginMaterialItem[] = []
  for (const observation of observations) {
    const userWords = userWordsOf(observation)
    if (typeof userWords === "string") material.push({ label: observation.id, text: userWords })
    else if (!observation.origin || DURABLE_ORIGINS.includes(observation.origin)) {
      material.push({ label: observation.id, text: presentedContent(observation) })
    }
  }
  return material
}

export function correctionMaterial(corrections: LedgerObservation[], notes: SavedNote[]): OriginMaterialItem[] {
  if (notes.length === 0) return []
  return corrections.map((observation) => ({
    label: `correction ${observation.id}`,
    text: `${CORRECTION_LEAD} ${observation.content}`,
  }))
}

export function awaitsVerification(observations: LedgerObservation[]): boolean {
  return observations.some((observation) => observation.origin === "unverified")
}
