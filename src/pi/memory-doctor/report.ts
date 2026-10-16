import type { DiagnosedMemory, ModelReport, VaultReport, VaultReportFailure } from "#src/usecases"
import {
  BLANK_HEADING,
  COULD_NOT_CHECK,
  DOCTOR_INVALID_HEADING,
  DOCTOR_NO_PROJECT_VAULT,
  DOCTOR_TITLE,
  DUPLICATES_HEADING,
  MODELS_HEADING,
  NO_PROBLEMS,
  NOT_USED_YET,
  TEMPORARIES_HEADING,
  UNREADABLE_HEADING,
  UNUSED_PROVIDERS,
} from "./constants.ts"

export function renderDoctorReport(diagnosed: DiagnosedMemory): string {
  const sections = diagnosed.vaults.map((report) => renderVault(report, diagnosed.maxNotesPerFolder))
  const lines = [DOCTOR_TITLE, "", ...sections.flatMap((section) => [...section, ""])]
  if (diagnosed.projectMissing) lines.push(DOCTOR_NO_PROJECT_VAULT, "")
  lines.push(MODELS_HEADING, ...diagnosed.models.map(renderModel))
  lines.push(...UNUSED_PROVIDERS.map((name) => `- ${name}: ${NOT_USED_YET}`))
  return lines.join("\n")
}

function renderVault(report: VaultReport | VaultReportFailure, limit: number): string[] {
  const title = vaultTitle(report.vault)
  if ("problems" in report) return [`${title}: ${COULD_NOT_CHECK}`, ...report.problems.map((problem) => `- ${problem}`)]
  const { diagnosis } = report
  const groups: string[][] = []
  addGroup(
    groups,
    DOCTOR_INVALID_HEADING,
    diagnosis.invalid.map((note) => `${note.path}: ${note.problems.join("; ")}`),
  )
  addGroup(
    groups,
    DUPLICATES_HEADING,
    diagnosis.duplicateIds.map((copy) => `${copy.id}: ${copy.paths.join(", ")}`),
  )
  addGroup(groups, BLANK_HEADING, diagnosis.blank)
  addGroup(groups, TEMPORARIES_HEADING, diagnosis.temporaries)
  addGroup(
    groups,
    `Folders above ${limit} notes (consider splitting them):`,
    diagnosis.crowdedFolders.map((folder) => `${folder.folder}: ${folder.count} notes`),
  )
  addGroup(groups, UNREADABLE_HEADING, report.unreadable)
  if (groups.length === 0) return [`${title}: ${NO_PROBLEMS}`]
  return [`${title}:`, ...groups.flat()]
}

function addGroup(groups: string[][], heading: string, items: string[]): void {
  if (items.length === 0) return
  groups.push([heading, ...items.map((item) => `- ${item}`)])
}

function vaultTitle(scope: string): string {
  if (scope === "global") return "Global vault"
  return "Project vault"
}

function renderModel(report: ModelReport): string {
  const { check } = report
  const name = `${report.role} ${check.model.provider}/${check.model.id}`
  if (check.status === "ok") return `- ${name}: ok`
  return `- ${name}: ${check.problem}`
}
