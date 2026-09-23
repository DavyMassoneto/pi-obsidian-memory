import type { GitFlowConfig } from "./gitflow.ts"
import { compareVersions } from "./version.ts"

export type StepId = "start" | "version" | "changelog" | "commit" | "finish" | "checkout" | "push"

interface StepBase {
  readonly id: StepId
  readonly title: string
  readonly recovery: string
}

interface RunStep extends StepBase {
  readonly kind: "run"
  readonly command: string
  readonly args: readonly string[]
}

interface SetVersionStep extends StepBase {
  readonly kind: "set-version"
  readonly version: string
}

interface ChangelogStep extends StepBase {
  readonly kind: "changelog"
  readonly tag: string
}

export type Step = RunStep | SetVersionStep | ChangelogStep

interface Release {
  readonly version: string
  readonly tag: string
  readonly branch: string
}

export interface ReleasePlan extends Release {
  readonly currentVersion: string
  readonly steps: readonly Step[]
}

export interface PlanInput {
  readonly config: GitFlowConfig
  readonly remote: string
  readonly currentVersion: string
  readonly nextVersion: string
  readonly releaseFiles: readonly string[]
}

interface StepContext extends PlanInput {
  readonly release: Release
}

type StepBuilder = (context: StepContext) => Step

export class NothingToRelease extends Error {
  constructor(currentVersion: string, nextVersion: string) {
    super(
      `nada para lançar: a próxima versão calculada (${nextVersion}) não é maior que a atual (${currentVersion}). ` +
        "Só há commits que não mudam a versão (docs, chore, ci…); para lançar mesmo assim, use --bump patch.",
    )
    this.name = "NothingToRelease"
  }
}

const STEPS: readonly StepBuilder[] = [
  startStep,
  versionStep,
  changelogStep,
  commitStep,
  finishStep,
  checkoutStep,
  pushStep,
]

export function buildPlan(input: PlanInput): ReleasePlan {
  const { config, currentVersion, nextVersion } = input
  if (compareVersions(nextVersion, currentVersion) <= 0) throw new NothingToRelease(currentVersion, nextVersion)
  const release: Release = {
    version: nextVersion,
    tag: `${config.tagPrefix}${nextVersion}`,
    branch: `${config.releasePrefix}${nextVersion}`,
  }
  const context: StepContext = { ...input, release }
  return { ...release, currentVersion, steps: STEPS.map((build) => build(context)) }
}

function startStep(context: StepContext): Step {
  const { config, release } = context
  return {
    id: "start",
    kind: "run",
    title: `Abrir ${release.branch} a partir da ${config.develop}`,
    command: "git",
    args: ["flow", "release", "start", release.version],
    recovery: `Nada mudou nas branches principais. Se ${release.branch} chegou a ser criada: ${abandonCommand(context)}`,
  }
}

function versionStep(context: StepContext): Step {
  const { version } = context.release
  return {
    id: "version",
    kind: "set-version",
    title: `Versão ${version} no package.json`,
    version,
    recovery: insideReleaseRecovery(context),
  }
}

function changelogStep(context: StepContext): Step {
  return {
    id: "changelog",
    kind: "changelog",
    title: "Gerar o CHANGELOG.md",
    tag: context.release.tag,
    recovery: insideReleaseRecovery(context),
  }
}

function commitStep(context: StepContext): Step {
  const message = `chore(release): ${context.release.tag}`
  return {
    id: "commit",
    kind: "run",
    title: `Commit "${message}"`,
    command: "git",
    args: ["commit", "-m", message, "--", ...context.releaseFiles],
    recovery: insideReleaseRecovery(context),
  }
}

function finishStep({ config, release }: StepContext): Step {
  const args = ["flow", "release", "finish", release.version, "--message", release.tag, "--no-push"]
  return {
    id: "finish",
    kind: "run",
    title: `Fechar o release: merge na ${config.main}, tag ${release.tag} e merge de volta na ${config.develop}`,
    command: "git",
    args,
    recovery: `Se parou num conflito de merge: resolva, faça git add e rode de novo: git ${args.join(" ")}`,
  }
}

// O git flow release finish termina na branch de produção; o trabalho continua na de integração.
function checkoutStep(context: StepContext): Step {
  const { develop } = context.config
  const push = `git ${pushArgs(context).join(" ")}`
  return {
    id: "checkout",
    kind: "run",
    title: `Voltar para a ${develop}`,
    command: "git",
    args: ["checkout", develop],
    recovery: `O release está completo localmente. Volte com git checkout ${develop} e envie: ${push}`,
  }
}

function pushStep(context: StepContext): Step {
  const { config, release, remote } = context
  const args = pushArgs(context)
  return {
    id: "push",
    kind: "run",
    title: `Enviar ${config.main}, ${config.develop} e ${release.tag} para ${remote}`,
    command: "git",
    args,
    recovery: `O release está completo localmente; falta só enviar: git ${args.join(" ")}`,
  }
}

function pushArgs({ config, release, remote }: StepContext): string[] {
  return ["push", "--atomic", remote, config.main, config.develop, release.tag]
}

function abandonCommand({ config, release }: StepContext): string {
  return `git checkout ${config.develop} && git flow release delete --force ${release.version}`
}

function insideReleaseRecovery(context: StepContext): string {
  return (
    `Você está na ${context.release.branch}. Corrija o problema e continue à mão a partir deste passo, ` +
    `ou abandone o release: ${abandonCommand(context)}`
  )
}
