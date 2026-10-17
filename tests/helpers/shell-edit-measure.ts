import { executedFiles, firedQuestions, type ShellEditQuestionName, type ShellEditScores } from "#src/domain"
import { askShellEdit, readExecutedScripts } from "#src/services"
import { startDownloadSource, withDownloadSource } from "./download-source.ts"
import { resetShellEditProject } from "./shell-edit.ts"
import { liveShellEditClassifier } from "./shell-edit-classifier.ts"
import type { LabelledShellCommand } from "./shell-edit-label.ts"
import { MEASURED_SHELL_COMMANDS } from "./shell-edit-labels.ts"
import { useTempFolder } from "./temp-folder.ts"
import { CUTOFFS, type CutoffRow, cutoffRow, type ScoredExample } from "./threshold-report.ts"

export interface CheckMarked extends LabelledShellCommand {
  check: boolean
}

export interface ScoredShellCommand extends CheckMarked {
  scores: ShellEditScores
  reportedModel: string
}

export interface QuestionMeasure {
  name: ShellEditQuestionName
  cutoff: number | null
  pickedBy: string
  check: CutoffRow | null
  separates: boolean
}

interface PickedCutoff {
  cutoff: number
  pickedBy: string
}

export interface RuleMeasure {
  truePositives: number
  falsePositives: number
  falseNegatives: number
  precision: number
  recall: number
}

export function withCheckGroup(items: LabelledShellCommand[]): CheckMarked[] {
  const seen = new Map<string, number>()
  return items.map((item) => {
    let count = 0
    const previous = seen.get(item.expected)
    if (typeof previous === "number") count = previous
    seen.set(item.expected, count + 1)
    return { ...item, check: count % 2 === 1 }
  })
}

export async function scoreLabelledCommands(): Promise<ScoredShellCommand[]> {
  const cwd = await useTempFolder()
  await resetShellEditProject(cwd)
  const classifier = await liveShellEditClassifier()
  const sourceUrl = await startDownloadSource()
  const scored: ScoredShellCommand[] = []
  for (const item of withCheckGroup(MEASURED_SHELL_COMMANDS)) {
    const command = withDownloadSource(item.command, sourceUrl)
    const read = await readExecutedScripts(cwd, executedFiles(command))
    if (!read.succeeded) throw new Error(read.problems.join("\n"))
    const state = { command, cwd, scripts: read.output.scripts, missing: read.output.missing }
    const asked = await askShellEdit({ classifier, state, signal: new AbortController().signal })
    if (!asked.succeeded) throw new Error(`${item.command}: ${asked.problems.join("; ")}`)
    scored.push({ ...item, scores: asked.output.scores, reportedModel: asked.output.reportedModel })
  }
  return scored
}

function fitCutoff(fit: ScoredExample[]): PickedCutoff | null {
  const complete = CUTOFFS.map((cutoff) => cutoffRow(fit, cutoff)).filter((row) => row.falseNegatives === 0)
  if (complete.length === 0) return null
  const fewest = Math.min(...complete.map((row) => row.falsePositives))
  const tied = complete.filter((row) => row.falsePositives === fewest).map((row) => row.cutoff)
  const distance = (cutoff: number) => Math.abs(cutoff - 0.5)
  const picked = tied.reduce((best, cutoff) => {
    if (distance(cutoff) < distance(best)) return cutoff
    return best
  })
  if (tied.length === 1) return { cutoff: picked, pickedBy: "only cutoff with fewest false refusals" }
  const range = `${tied[0]}-${tied[tied.length - 1]}`
  return { cutoff: picked, pickedBy: `closest to 0.5 (lower on equal distance) of ${tied.length} tied, ${range}` }
}

export function measureQuestion(scored: ScoredShellCommand[], name: ShellEditQuestionName): QuestionMeasure {
  const examples = scored
    .filter((item) => item.expected === name || item.expected === "allow")
    .map((item) => ({ score: item.scores[name], positive: item.expected === name, holdout: item.check }))
  const picked = fitCutoff(examples.filter((example) => !example.holdout))
  if (!picked) return { name, cutoff: null, pickedBy: "none", check: null, separates: false }
  const { cutoff, pickedBy } = picked
  const check = cutoffRow(
    examples.filter((example) => example.holdout),
    cutoff,
  )
  return { name, cutoff, pickedBy, check, separates: check.falseNegatives === 0 && check.falsePositives === 0 }
}

function cutoffOf(measures: QuestionMeasure[], name: ShellEditQuestionName): number {
  const found = measures.find((measure) => measure.name === name)
  if (!found || typeof found.cutoff !== "number") throw new Error(`${name} has no cutoff`)
  return found.cutoff
}

export function measuredCutoffs(measures: QuestionMeasure[]): ShellEditScores {
  return {
    redirection: cutoffOf(measures, "redirection"),
    in_place: cutoffOf(measures, "in_place"),
    inline_code: cutoffOf(measures, "inline_code"),
    script_writes: cutoffOf(measures, "script_writes"),
    copy_download: cutoffOf(measures, "copy_download"),
    hardlink: cutoffOf(measures, "hardlink"),
  }
}

export function measureRule(scored: ScoredShellCommand[], cutoffs: ShellEditScores): RuleMeasure {
  const check = scored.filter((item) => item.check)
  const refused = (item: ScoredShellCommand) => firedQuestions(item.scores, cutoffs).length > 0
  const truePositives = check.filter((item) => item.expected !== "allow" && refused(item)).length
  const falsePositives = check.filter((item) => item.expected === "allow" && refused(item)).length
  const falseNegatives = check.filter((item) => item.expected !== "allow" && !refused(item)).length
  const precision = truePositives / (truePositives + falsePositives)
  const recall = truePositives / (truePositives + falseNegatives)
  return { truePositives, falsePositives, falseNegatives, precision, recall }
}

function groupOf(item: CheckMarked): string {
  if (item.check) return "check"
  return "fit"
}

function questionRow(measure: QuestionMeasure): string {
  const row = measure.check
  if (!row) return `| ${measure.name} | none refuses every fit positive | - | - | - | - | - | no | - |`
  const numbers = [
    row.truePositives,
    row.falsePositives,
    row.falseNegatives,
    row.precision.toFixed(2),
    row.recall.toFixed(2),
  ]
  return `| ${measure.name} | ${measure.cutoff} | ${numbers.join(" | ")} | ${measure.separates} | ${measure.pickedBy} |`
}

export function renderShellEditReport(scored: ScoredShellCommand[], measures: QuestionMeasure[]): string {
  const models = [...new Set(scored.map((item) => item.reportedModel))].join(", ")
  const lines = [`Date: ${new Date().toISOString()}`, `Answered by: ${models}`, `Commands: ${scored.length}`, ""]
  lines.push(
    "| question | fit cutoff | check TP | check FP | check FN | check precision | check recall | separates | picked by |",
    "|---|---|---|---|---|---|---|---|---|",
  )
  for (const measure of measures) lines.push(questionRow(measure))
  if (measures.every((measure) => typeof measure.cutoff === "number")) {
    const cutoffs = measuredCutoffs(measures)
    const rule = measureRule(scored, cutoffs)
    lines.push(
      "",
      `Final rule on the check group: TP ${rule.truePositives}, FP ${rule.falsePositives}, FN ${rule.falseNegatives}, precision ${rule.precision.toFixed(2)}, recall ${rule.recall.toFixed(2)}`,
      `Cutoffs: ${JSON.stringify(cutoffs)}`,
    )
  }
  lines.push("", "| shell | command | expected | group | scores |", "|---|---|---|---|---|")
  for (const item of scored) {
    lines.push(
      `| ${item.shell} | \`${item.command}\` | ${item.expected} | ${groupOf(item)} | ${JSON.stringify(item.scores)} |`,
    )
  }
  return lines.join("\n")
}
