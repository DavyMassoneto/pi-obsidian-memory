import { type CaptureCadenceSettings, type CaptureTally, EMPTY_TALLY, tallyTurn, tallyUserMessage } from "#src/domain"

export interface TurnsRun {
  tally: CaptureTally
  reviews: number
}

export const tallySettings: CaptureCadenceSettings = {
  nudgeInterval: 3,
  nudgeToolCalls: 5,
  flushMinTurns: 4,
  reviewEnabled: true,
  flushOnCompact: true,
  flushOnShutdown: true,
}

export function afterUserMessages(count: number): CaptureTally {
  let tally = EMPTY_TALLY
  for (let index = 0; index < count; index++) tally = tallyUserMessage(tally)
  return tally
}

export function runTurns(start: CaptureTally, turns: number, toolCalls: number): TurnsRun {
  let tally = start
  let reviews = 0
  for (let index = 0; index < turns; index++) {
    const outcome = tallyTurn(tally, { toolCalls, reviewActive: false }, tallySettings)
    tally = outcome.tally
    if (outcome.review) reviews++
  }
  return { tally, reviews }
}
