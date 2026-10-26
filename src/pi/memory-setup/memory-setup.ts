import type { MemoryCommand, MemoryPaths, MemoryPiContext } from "#src/pi/context"
import type { MemorySessionKeeper } from "#src/pi/memory-session"
import { type CurrentModel, chooseModel, RELOAD_NOTE, runSettingsScreen } from "#src/pi/memory-settings"
import { describeRegistered, describeRegistrationFailure } from "#src/pi/registration-report"
import {
  type ConfigRepairDraft,
  prepareMemorySettings,
  prepareMemorySetup,
  proposeMemorySetup,
  type RegistrationContext,
  type SetupPreparation,
  type SetupVaultMode,
  setupMemory,
} from "#src/usecases"
import {
  MEMORY_SETUP_DESCRIPTION,
  REPAIR_CONFIRM_LINE,
  REPAIR_TITLE,
  REPLACE_LINE,
  SETUP_AGENT_MODEL_TITLE,
  SETUP_ATTACH_OPTION,
  SETUP_CANCELLED,
  SETUP_CREATE_OPTION,
  SETUP_DONE,
  SETUP_KEEP_VAULT_TITLE,
  SETUP_MODE_TITLE,
  SETUP_NO_MODEL,
  SETUP_OBSERVER_MODEL_TITLE,
  SETUP_VAULT_PLACEHOLDER,
  SETUP_VAULT_TITLE,
} from "./constants.ts"
import { disclosureText } from "./disclosure.ts"
import type { VaultStep } from "./types.ts"

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
  const settings = await prepareMemorySettings(registration)
  if (settings.succeeded) {
    await runSettingsScreen(ctx, { registration, changeGlobalVault: (context) => changeVault(ctx, context) })
    return
  }
  await runFirstSetup(ctx, registration)
}

async function runFirstSetup(ctx: MemoryPiContext, registration: RegistrationContext): Promise<void> {
  const preparation = await prepareSetup(ctx, registration)
  if (!preparation) return
  if (!(await confirmRepair(ctx, preparation.draft))) return cancelled(ctx)
  if (noModelToChoose(ctx, preparation.draft)) return
  const draft = await chooseModels(ctx, preparation.draft)
  if (!draft) return cancelled(ctx)
  await commitVault(ctx, registration, { snapshot: preparation.snapshot, draft })
}

async function changeVault(ctx: MemoryPiContext, registration: RegistrationContext): Promise<void> {
  const preparation = await prepareSetup(ctx, registration)
  if (!preparation) return
  await commitVault(ctx, registration, preparation)
}

async function commitVault(
  ctx: MemoryPiContext,
  registration: RegistrationContext,
  preparation: VaultStep,
): Promise<void> {
  const { snapshot, draft } = preparation
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
  const saved = describeRegistered(`${SETUP_DONE} ${proposal.output.config.global.vault}`, result.output)
  ctx.ui.notify(`${saved}\n${RELOAD_NOTE}`, "info")
}

function cancelled(ctx: MemoryPiContext): void {
  ctx.ui.notify(SETUP_CANCELLED, "info")
}

async function prepareSetup(ctx: MemoryPiContext, registration: RegistrationContext): Promise<SetupPreparation | null> {
  const preparation = await prepareMemorySetup({ selectedModel: null }, registration)
  if (!preparation.succeeded) {
    ctx.ui.notify(preparation.problems.join("\n"), "error")
    return null
  }
  return preparation.output
}

function modelResolved(model: ConfigRepairDraft["observer"]["model"]): boolean {
  return typeof model.provider === "string" && typeof model.id === "string"
}

function noModelToChoose(ctx: MemoryPiContext, draft: ConfigRepairDraft): boolean {
  if (ctx.modelRegistry.getAvailable().length > 0) return false
  if (modelResolved(draft.observer.model) && modelResolved(draft.memoryAgent.model)) return false
  ctx.ui.notify(SETUP_NO_MODEL, "error")
  return true
}

function inUseOf(ctx: MemoryPiContext): CurrentModel {
  if (!ctx.model) return {}
  return { provider: ctx.model.provider, id: ctx.model.id }
}

async function chooseModels(ctx: MemoryPiContext, draft: ConfigRepairDraft): Promise<ConfigRepairDraft | null> {
  const observer = await chooseModel(ctx, SETUP_OBSERVER_MODEL_TITLE, draft.observer.model, inUseOf(ctx))
  if (!observer) return null
  const agent = await chooseModel(ctx, SETUP_AGENT_MODEL_TITLE, draft.memoryAgent.model, {})
  if (!agent) return null
  return {
    ...draft,
    capture: { ...draft.capture, model: observer },
    observer: { ...draft.observer, model: observer },
    memoryAgent: { model: agent },
  }
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
