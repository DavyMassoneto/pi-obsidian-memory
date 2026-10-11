import { mkdir } from "node:fs/promises"

import {
  renderVaultAssets,
  type VaultBootstrapProgress,
  type VaultBootstrapResult,
  type VaultCatalogFailure,
} from "#/domain"
import { catalogIoFailure, resolveCatalogRoot } from "#/services/vault/catalog"
import type { NamedVaultContext } from "#/services/vault/context"
import { ensureTemplateFolder } from "./paths.ts"
import { createAssetExclusively } from "./write.ts"

export async function ensureVaultAssets(vault: NamedVaultContext): Promise<VaultBootstrapResult> {
  const progress: VaultBootstrapProgress = { createdRoot: false, created: [], preserved: [], maintenanceProblems: [] }
  try {
    const created = await mkdir(vault.path, { recursive: true })
    progress.createdRoot = typeof created === "string"
  } catch (error) {
    if (!(error instanceof Error)) throw error
    return bootstrapFailure(progress, catalogIoFailure(error, { path: "", scope: "directory" }))
  }
  const root = await resolveCatalogRoot(vault)
  if (!root.succeeded) return bootstrapFailure(progress, root)
  const templates = await ensureTemplateFolder(root.output)
  if (!templates.succeeded) return bootstrapFailure(progress, templates)
  return installAssets(root.output, templates.output, progress)
}

async function installAssets(
  root: string,
  templates: string,
  progress: VaultBootstrapProgress,
): Promise<VaultBootstrapResult> {
  for (const asset of renderVaultAssets()) {
    let folder = ""
    let name = asset.path
    if (asset.path.startsWith("_templates/")) {
      folder = templates
      name = asset.path.slice("_templates/".length)
    }
    const written = await createAssetExclusively({ root, folder, name, content: asset.content, progress })
    if (!written.succeeded) return bootstrapFailure(progress, written)
  }
  return { succeeded: true, output: progress }
}

function bootstrapFailure(progress: VaultBootstrapProgress, failure: VaultCatalogFailure): VaultBootstrapResult {
  return { succeeded: false, ...progress, failure, problems: failure.problems }
}
