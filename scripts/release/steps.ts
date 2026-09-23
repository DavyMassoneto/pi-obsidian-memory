import type { Step, StepContext } from "./plan.types.ts"

export function startStep(context: StepContext): Step {
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

export function versionStep(context: StepContext): Step {
  const { version } = context.release
  return {
    id: "version",
    kind: "set-version",
    title: `Versão ${version} no package.json`,
    version,
    recovery: insideReleaseRecovery(context),
  }
}

export function changelogStep(context: StepContext): Step {
  return {
    id: "changelog",
    kind: "changelog",
    title: "Gerar o CHANGELOG.md",
    tag: context.release.tag,
    recovery: insideReleaseRecovery(context),
  }
}

export function commitStep(context: StepContext): Step {
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

export function finishStep({ config, release }: StepContext): Step {
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
export function checkoutStep(context: StepContext): Step {
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

export function pushStep(context: StepContext): Step {
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
