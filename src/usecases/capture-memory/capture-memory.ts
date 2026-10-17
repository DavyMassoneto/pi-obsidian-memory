import {
  type CaptureAction,
  type CaptureObservation,
  type CompletionPort,
  captureStep,
  type ReadObservation,
  type TranscriptWindow,
  transcriptWindows,
} from "#src/services"
import { type MemoryOperationContext, memoryOperationInterruption } from "#src/usecases/operation-context"
import { resolveMemory } from "#src/usecases/resolve-memory"
import { applyWrite } from "./apply.ts"
import { INTERRUPTED, MAX_REFUSAL_PROBLEMS } from "./constants.ts"
import { observeGet, observeList, observeRead, observeSearch } from "./observe.ts"
import type {
  CaptureBase,
  CaptureFailure,
  CaptureMemoryResult,
  CaptureReport,
  CaptureRun,
  ClarifyPort,
  NextStep,
  ReviewTools,
  WriteAction,
} from "./types.ts"

export async function captureMemory(
  run: CaptureRun,
  context: MemoryOperationContext,
  complete: CompletionPort,
  ask: ClarifyPort,
): Promise<CaptureMemoryResult> {
  const resolved = await resolveMemory(context)
  if (!resolved.succeeded) return resolved
  const { config, project } = resolved.output
  if (config.capture.when !== run.trigger) return { succeeded: true, output: { windows: 0, applied: [], skipped: [] } }
  const explicitSaves: ReadObservation[] = []
  for (const save of run.explicitSaves) {
    const read = await observeRead(save, context)
    if (typeof read !== "string") explicitSaves.push(read)
  }
  let projectName: string | null = null
  if (project) projectName = project.vault.name
  const base: CaptureBase = {
    context: { project: projectName, folder: context.workingFolder },
    explicitSaves,
    limits: { maxBodyChars: config.limits.maxBodyChars, maxStatementChars: config.limits.maxStatementChars },
    model: config.capture.model,
    signal: context.signal,
  }
  const report: CaptureReport = { windows: 0, applied: [], skipped: [] }
  const tools: ReviewTools = { context, complete, ask, report }
  for (const window of transcriptWindows(run.messages)) {
    report.windows += 1
    const failure = await reviewWindow(window, base, tools)
    if (failure) return failure
  }
  return { succeeded: true, output: report }
}

async function reviewWindow(
  window: TranscriptWindow,
  base: CaptureBase,
  tools: ReviewTools,
): Promise<CaptureFailure | null> {
  const observations: CaptureObservation[] = []
  for (;;) {
    if (memoryOperationInterruption(tools.context)) return failureOf("interrupted", [INTERRUPTED], tools)
    const step = await captureStep({ ...base, transcriptDelta: window, observations }, tools.complete)
    if (!step.succeeded && "modelCall" in step) {
      if (memoryOperationInterruption(tools.context)) return failureOf("interrupted", [INTERRUPTED], tools)
      return failureOf("model-failed", step.problems, tools)
    }
    if (!step.succeeded) {
      observations.push(refusedStep(step.problems))
      continue
    }
    if ((await act(step.output, observations, base, tools)) === "stop") return endOfWindow(tools)
  }
}

function endOfWindow(tools: ReviewTools): CaptureFailure | null {
  if (memoryOperationInterruption(tools.context)) return failureOf("interrupted", [INTERRUPTED], tools)
  return null
}

function refusedStep(problems: string[]): CaptureObservation {
  const texts = problems.filter((problem) => problem.trim() !== "").slice(0, MAX_REFUSAL_PROBLEMS)
  return { kind: "refused", action: "unparseable", problems: texts }
}

async function act(
  action: CaptureAction,
  observations: CaptureObservation[],
  base: CaptureBase,
  tools: ReviewTools,
): Promise<NextStep> {
  const { context } = tools
  if (action.action === "finish") return "stop"
  if (action.action === "clarify") return clarify(action.question, observations, base, tools)
  if (action.action === "search") {
    observations.push(await observeSearch(action.vault, action.query, action.limit, context))
  } else if (action.action === "get") {
    observations.push(await observeGet({ vault: action.vault, path: action.path }, context))
  } else if (action.action === "list") {
    observations.push(await observeList(action.vault, action.folder, context))
  } else {
    await write(action, observations, tools)
  }
  return "continue"
}

async function clarify(
  question: string,
  observations: CaptureObservation[],
  base: CaptureBase,
  tools: ReviewTools,
): Promise<NextStep> {
  const answer = await tools.ask(question, { signal: base.signal })
  if (typeof answer !== "string" || answer.trim() === "") {
    tools.report.skipped.push(question)
    return "stop"
  }
  observations.push({ kind: "clarification", question, answer })
  return "continue"
}

async function write(action: WriteAction, observations: CaptureObservation[], tools: ReviewTools): Promise<void> {
  const applied = await applyWrite(action, tools.context)
  tools.report.applied.push(applied)
  observations.push({ kind: "write", ...applied })
}

function failureOf(reason: CaptureFailure["reason"], problems: string[], tools: ReviewTools): CaptureFailure {
  return { succeeded: false, reason, problems, report: tools.report }
}
