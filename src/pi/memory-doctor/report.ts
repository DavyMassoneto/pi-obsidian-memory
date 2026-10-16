import type {
  CutoffReport,
  CutoffValue,
  DecisionReport,
  DiagnosedMemory,
  EmbeddingReport,
  ModelReport,
  VaultReport,
  VaultReportFailure,
} from "#src/usecases"
import {
  BLANK_HEADING,
  COULD_NOT_CHECK,
  CUTOFF_SOURCES,
  CUTOFFS_HINT,
  DOCTOR_INVALID_HEADING,
  DOCTOR_NO_PROJECT_VAULT,
  DOCTOR_TITLE,
  DUPLICATES_HEADING,
  MODELS_HEADING,
  NO_PROBLEMS,
  TEMPORARIES_HEADING,
  UNREADABLE_HEADING,
} from "./constants.ts"

export function renderDoctorReport(diagnosed: DiagnosedMemory): string {
  const sections = diagnosed.vaults.map((report) => renderVault(report, diagnosed.maxNotesPerFolder))
  const lines = [DOCTOR_TITLE, "", ...sections.flatMap((section) => [...section, ""])]
  if (diagnosed.projectMissing) lines.push(DOCTOR_NO_PROJECT_VAULT, "")
  lines.push(MODELS_HEADING, ...diagnosed.models.map(renderModel), renderEmbeddings(diagnosed.embeddings))
  lines.push(renderDecision(diagnosed.decision), renderCutoffs(diagnosed.cutoffs))
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

function renderEmbeddings(report: EmbeddingReport): string {
  const name = `embeddings ${report.provider}/${report.model}`
  if (report.status === "ready") return `- ${name}: ready`
  return `- ${name}: ${report.problem}`
}

function renderDecision(report: DecisionReport): string {
  const name = `decision model ${report.provider}/${report.model}`
  if ("problem" in report) return `- ${name}: ${report.problem}`
  return `- ${name}: ready (${report.detail})`
}

function cutoffText(name: string, value: CutoffValue): string {
  const source = CUTOFF_SOURCES.get(value.source)
  if (typeof value.value !== "number") return `${name} ${source}`
  return `${name} ${value.value} (${source})`
}

function renderCutoffs(cutoffs: CutoffReport): string {
  const line = `- decision cutoffs: ${cutoffText("gate", cutoffs.gate)}, ${cutoffText("relevance", cutoffs.relevance)}`
  if (cutoffs.gate.source === "missing" || cutoffs.relevance.source === "missing") return `${line}; ${CUTOFFS_HINT}`
  return line
}

function renderModel(report: ModelReport): string {
  const { check } = report
  const name = `${report.role} ${check.model.provider}/${check.model.id}`
  if (check.status === "ok") return `- ${name}: ok`
  return `- ${name}: ${check.problem}`
}
