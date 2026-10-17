import type { ChatModelSource, MemoryPiContext } from "#src/pi/context"
import type { ChatModelReference } from "#src/usecases"
import { CURRENT_MARK, IN_USE_MARK, PRICE_DECIMALS, PRICE_SEPARATOR } from "./constants.ts"
import type { CurrentModel, ModelChoice } from "./types.ts"

function priceText(value: number): string {
  return `$${Number(value.toFixed(PRICE_DECIMALS))}`
}

export function modelLabel(model: ChatModelSource, mark: string | null): string {
  let label = `${model.provider}/${model.id}`
  if (mark) label = `${label} ${mark}`
  if (!model.cost) return label
  const prices = `${priceText(model.cost.input)} in / ${priceText(model.cost.output)} out per 1M tokens`
  return `${label}${PRICE_SEPARATOR}${prices}`
}

function sameModel(model: ChatModelSource, current: CurrentModel): boolean {
  return model.provider === current.provider && model.id === current.id
}

function inputPrice(model: ChatModelSource): number {
  if (model.cost) return model.cost.input
  return Number.POSITIVE_INFINITY
}

function byPrice(left: ChatModelSource, right: ChatModelSource): number {
  const leftPrice = inputPrice(left)
  const rightPrice = inputPrice(right)
  if (leftPrice === rightPrice) return 0
  if (leftPrice < rightPrice) return -1
  return 1
}

function firstChoice(available: ChatModelSource[], current: CurrentModel, inUse: CurrentModel): ModelChoice | null {
  let first = current
  let mark = CURRENT_MARK
  if (typeof current.provider !== "string" || typeof current.id !== "string") {
    first = inUse
    mark = IN_USE_MARK
  }
  if (typeof first.provider !== "string" || typeof first.id !== "string") return null
  const reference = { provider: first.provider, id: first.id }
  let shown: ChatModelSource = reference
  const known = available.find((model) => sameModel(model, first))
  if (known) shown = known
  return { label: modelLabel(shown, mark), reference, current: true }
}

export function modelChoices(available: ChatModelSource[], current: CurrentModel, inUse: CurrentModel): ModelChoice[] {
  const first = firstChoice(available, current, inUse)
  const others = available
    .filter((model) => !first || !sameModel(model, first.reference))
    .sort(byPrice)
    .map((model) => ({
      label: modelLabel(model, null),
      reference: { provider: model.provider, id: model.id },
      current: false,
    }))
  if (!first) return others
  return [first, ...others]
}

export async function chooseModel(
  ctx: MemoryPiContext,
  title: string,
  current: CurrentModel,
  inUse: CurrentModel,
): Promise<ChatModelReference | null> {
  const choices = modelChoices(ctx.modelRegistry.getAvailable(), current, inUse)
  const answer = await ctx.ui.select(
    title,
    choices.map((choice) => choice.label),
  )
  const chosen = choices.find((choice) => choice.label === answer)
  if (chosen) return chosen.reference
  if (typeof answer === "string" && answer !== "") return null
  const kept = choices.find((choice) => choice.current)
  if (kept) return kept.reference
  return null
}
