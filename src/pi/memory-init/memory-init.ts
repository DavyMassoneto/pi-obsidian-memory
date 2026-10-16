import type { MemoryCommand, MemoryPaths, MemoryPiContext } from "#src/pi/context"
import type { MemorySessionKeeper } from "#src/pi/memory-session"
import { describeRegistered, describeRegistrationFailure } from "#src/pi/registration-report"
import {
  checkProjectName,
  type InitPreparation,
  initProjectMemory,
  prepareProjectInit,
  type RegistrationContext,
} from "#src/usecases"
import {
  INIT_CANCELLED,
  INIT_DONE,
  INIT_NAME_TITLE,
  INIT_REPOINT_VAULT_TITLE,
  INIT_SETUP_HINT,
  INIT_VAULT_PLACEHOLDER,
  INIT_VAULT_TITLE,
  MEMORY_INIT_DESCRIPTION,
} from "./constants.ts"

export function memoryInitCommand(paths: MemoryPaths, sessions: MemorySessionKeeper): MemoryCommand {
  return {
    description: MEMORY_INIT_DESCRIPTION,
    async handler(_args, ctx) {
      if (!ctx.hasUI) return
      const { registration } = sessions.registrationFlow(ctx, paths)
      await runMemoryInit(ctx, registration)
    },
  }
}

async function runMemoryInit(ctx: MemoryPiContext, registration: RegistrationContext): Promise<void> {
  const preparation = await prepareProjectInit(registration)
  if (!preparation.succeeded) {
    const lines = [...preparation.problems]
    if (preparation.reason !== "unreadable") lines.push(INIT_SETUP_HINT)
    return ctx.ui.notify(lines.join("\n"), "error")
  }
  const name = await askName(ctx, preparation.output)
  if (typeof name !== "string") return ctx.ui.notify(INIT_CANCELLED, "info")
  const vault = await askVault(ctx, preparation.output)
  if (typeof vault !== "string") return ctx.ui.notify(INIT_CANCELLED, "info")
  const result = await initProjectMemory({ name, vault, expectedHash: preparation.output.expectedHash }, registration)
  if (!result.succeeded) return ctx.ui.notify(describeRegistrationFailure(result), "error")
  ctx.ui.notify(describeRegistered(`${INIT_DONE} ${name}`, result.output), "info")
}

async function askName(ctx: MemoryPiContext, preparation: InitPreparation): Promise<string | null> {
  if (preparation.existing) return preparation.existing.name
  for (;;) {
    const answer = await ctx.ui.input(INIT_NAME_TITLE, preparation.defaultName)
    if (typeof answer !== "string") return null
    const checked = checkProjectName(preparation, answer)
    if (checked.succeeded) return checked.output
    ctx.ui.notify(checked.problems.join("\n"), "error")
  }
}

function askVault(ctx: MemoryPiContext, preparation: InitPreparation): Promise<string | undefined> {
  if (preparation.existing) return ctx.ui.input(INIT_REPOINT_VAULT_TITLE, INIT_VAULT_PLACEHOLDER)
  return ctx.ui.input(INIT_VAULT_TITLE, INIT_VAULT_PLACEHOLDER)
}
