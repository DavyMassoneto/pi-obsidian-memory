import type { ChatModelSource, MemoryCommand, MemoryPaths, MemoryPiContext } from "#src/pi/context"
import type { MemorySessionKeeper } from "#src/pi/memory-session"
import { describeRegistered, describeRegistrationFailure } from "#src/pi/registration-report"
import {
  type ChatModelReference,
  type ConfigRepairDraft,
  prepareMemorySetup,
  proposeMemorySetup,
  type RegistrationContext,
  type SetupPreparation,
  type SetupVaultMode,
  setupMemory,
  setupNeedsModel,
} from "#src/usecases"
import {
  MEMORY_SETUP_DESCRIPTION,
  REPAIR_CONFIRM_LINE,
  REPAIR_TITLE,
  REPLACE_LINE,
  SETUP_ATTACH_OPTION,
  SETUP_CANCELLED,
  SETUP_CREATE_OPTION,
  SETUP_DONE,
  SETUP_KEEP_VAULT_TITLE,
  SETUP_MODE_TITLE,
  SETUP_MODEL_TITLE,
  SETUP_NO_MODEL,
  SETUP_VAULT_PLACEHOLDER,
  SETUP_VAULT_TITLE,
} from "./constants.ts"
import { disclosureText } from "./disclosure.ts"

export function memorySetupCommand(paths: MemoryPaths, sessions: MemorySessionKeeper): MemoryCommand {
  return {
    description: MEMORY_SETUP_DESCRIPTION,
    async handler(_args, ctx) {
      if (!ctx.hasUI) return
      const { registration } = sessions.registrationFlow(ctx, paths)
      await runMemorySetup(ctx, registration)
    },
  }
}

async function runMemorySetup(ctx: MemoryPiContext, registration: RegistrationContext): Promise<void> {
  const preparation = await prepareWithModel(ctx, registration)
  if (!preparation) return
  const { snapshot, draft } = preparation
  if (!(await confirmRepair(ctx, draft))) return cancelled(ctx)
  const mode = await askMode(ctx, draft)
  if (!mode) return cancelled(ctx)
  const vault = await askVault(ctx, draft)
  if (typeof vault !== "string") return cancelled(ctx)
  const proposal = await proposeMemorySetup({ draft, vault, mode }, registration)
  if (!proposal.succeeded) return ctx.ui.notify(proposal.problems.join("\n"), "error")
  ctx.ui.notify(disclosureText(proposal.output.disclosures), "warning")
  const result = await setupMemory(
    {
      config: proposal.output.config,
      expectedHash: snapshot.hash,
      replacementConfirmed: draft.replacementRequired,
    },
    registration,
  )
  if (!result.succeeded) return ctx.ui.notify(describeRegistrationFailure(result), "error")
  ctx.ui.notify(describeRegistered(`${SETUP_DONE} ${proposal.output.config.global.vault}`, result.output), "info")
}

function cancelled(ctx: MemoryPiContext): void {
  ctx.ui.notify(SETUP_CANCELLED, "info")
}

async function prepareWithModel(
  ctx: MemoryPiContext,
  registration: RegistrationContext,
): Promise<SetupPreparation | null> {
  let preparation = await prepareMemorySetup({ selectedModel: referenceOf(ctx.model) }, registration)
  if (preparation.succeeded && setupNeedsModel(preparation.output.draft)) {
    const chosen = await chooseModel(ctx)
    if (!chosen) return null
    preparation = await prepareMemorySetup({ selectedModel: chosen }, registration)
  }
  if (!preparation.succeeded) {
    ctx.ui.notify(preparation.problems.join("\n"), "error")
    return null
  }
  return preparation.output
}

function referenceOf(model: ChatModelSource | undefined): ChatModelReference | null {
  if (!model) return null
  return { provider: model.provider, id: model.id }
}

async function chooseModel(ctx: MemoryPiContext): Promise<ChatModelReference | null> {
  const available = ctx.modelRegistry.getAvailable()
  if (available.length === 0) {
    ctx.ui.notify(SETUP_NO_MODEL, "error")
    return null
  }
  const labels = available.map(modelLabel)
  const answer = await ctx.ui.select(SETUP_MODEL_TITLE, labels)
  const chosen = available.find((model) => modelLabel(model) === answer)
  if (!chosen) {
    cancelled(ctx)
    return null
  }
  return referenceOf(chosen)
}

function modelLabel(model: ChatModelSource): string {
  return `${model.provider}/${model.id}`
}

async function confirmRepair(ctx: MemoryPiContext, draft: ConfigRepairDraft): Promise<boolean> {
  if (draft.problems.length === 0 && !draft.replacementRequired) return true
  const lines = draft.problems.map((problem) => `- ${problem}`)
  if (draft.replacementRequired) lines.push(REPLACE_LINE)
  return ctx.ui.confirm(REPAIR_TITLE, [...lines, REPAIR_CONFIRM_LINE].join("\n"))
}

async function askMode(ctx: MemoryPiContext, draft: ConfigRepairDraft): Promise<SetupVaultMode | null> {
  let options = [SETUP_CREATE_OPTION, SETUP_ATTACH_OPTION]
  if (draft.global.vault) options = [SETUP_ATTACH_OPTION, SETUP_CREATE_OPTION]
  const answer = await ctx.ui.select(SETUP_MODE_TITLE, options)
  if (answer === SETUP_CREATE_OPTION) return "create"
  if (answer === SETUP_ATTACH_OPTION) return "attach"
  return null
}

function askVault(ctx: MemoryPiContext, draft: ConfigRepairDraft): Promise<string | undefined> {
  if (draft.global.vault) return ctx.ui.input(SETUP_KEEP_VAULT_TITLE, draft.global.vault)
  return ctx.ui.input(SETUP_VAULT_TITLE, SETUP_VAULT_PLACEHOLDER)
}
