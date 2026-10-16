import { inspectVaultFolder, proposeSetup, resolveRegistrationVault, setupDisclosures } from "#src/services"
import type { Failed } from "#src/shared"
import type { MemoryContext } from "#src/usecases/add-memory"
import type { ConfigRepairDraft, SetupProposalRequest, SetupProposalResult, SetupVaultMode } from "./types.ts"

export function setupNeedsModel(draft: ConfigRepairDraft): boolean {
  return !modelResolved(draft.capture.model) || !modelResolved(draft.memoryAgent.model)
}

export async function proposeMemorySetup(
  request: SetupProposalRequest,
  context: MemoryContext,
): Promise<SetupProposalResult> {
  let requested = request.vault.trim()
  if (requested === "" && request.draft.global.vault) requested = request.draft.global.vault
  const vault = resolveRegistrationVault({ vault: requested, workingFolder: context.workingFolder })
  if (!vault.succeeded) return vault
  const refusal = await vaultFolderRefusal(vault.output, request.mode)
  if (refusal) return refusal
  const proposal = proposeSetup({ config: request.draft, vault: vault.output })
  if (!proposal.succeeded) return proposal
  return { succeeded: true, output: { config: proposal.output, disclosures: setupDisclosures(proposal.output) } }
}

async function vaultFolderRefusal(vault: string, mode: SetupVaultMode): Promise<Failed | null> {
  const folder = await inspectVaultFolder(vault)
  if (!folder.succeeded) return folder
  if (folder.output === "not-directory") {
    return { succeeded: false, problems: [`${vault} is not a folder`] }
  }
  if (mode === "create" && folder.output === "populated") {
    return { succeeded: false, problems: [`${vault} already has files; attach it instead of creating a new vault`] }
  }
  if (mode === "attach" && folder.output === "missing") {
    return { succeeded: false, problems: [`${vault} does not exist; create it instead of attaching`] }
  }
  return null
}

function modelResolved(model: ConfigRepairDraft["capture"]["model"]): boolean {
  return typeof model.provider === "string" && typeof model.id === "string"
}
