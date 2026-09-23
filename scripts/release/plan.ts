import type { GitFlowConfig } from "./gitflow.ts";
import { compareVersions, parseVersion } from "./version.ts";

export type StepId = "start" | "version" | "changelog" | "commit" | "finish" | "checkout" | "push";

interface StepBase {
  readonly id: StepId;
  readonly title: string;
  /** O que fazer se este passo falhar. */
  readonly recovery: string;
}

/** Um passo do release: um comando externo ou uma tarefa interna. */
export type Step =
  | (StepBase & { readonly kind: "run"; readonly command: string; readonly args: readonly string[] })
  | (StepBase & { readonly kind: "set-version"; readonly version: string })
  | (StepBase & { readonly kind: "changelog"; readonly tag: string });

export interface ReleasePlan {
  readonly version: string;
  readonly tag: string;
  readonly branch: string;
  readonly steps: readonly Step[];
}

export interface PlanInput {
  readonly config: GitFlowConfig;
  readonly remote: string;
  /** Versão atual (a do package.json). */
  readonly current: string;
  /** Versão calculada para o release. */
  readonly next: string;
  /** Arquivos alterados pelo release (versão e changelog). */
  readonly files: readonly string[];
}

/** O cálculo não produziu uma versão maior que a atual. */
export class NothingToRelease extends Error {
  constructor(current: string, next: string) {
    super(
      `nada para lançar: a próxima versão calculada (${next}) não é maior que a atual (${current}). ` +
        `Só há commits que não mudam a versão (docs, chore, ci…); para lançar mesmo assim, use --bump patch.`,
    );
    this.name = "NothingToRelease";
  }
}

/** Monta os passos do release. Função pura: não toca em git nem em disco. */
export function buildPlan({ config, remote, current, next, files }: PlanInput): ReleasePlan {
  parseVersion(current);
  parseVersion(next);
  if (compareVersions(next, current) <= 0) throw new NothingToRelease(current, next);

  const tag = `${config.tagPrefix}${next}`;
  const branch = `${config.releasePrefix}${next}`;
  const pushArgs = ["push", "--atomic", remote, config.main, config.develop, tag];
  const insideRelease =
    `Você está na ${branch}. Corrija o problema e continue à mão a partir deste passo, ` +
    `ou abandone o release: git checkout ${config.develop} && git flow release delete --force ${next}`;

  const steps: Step[] = [
    {
      id: "start",
      kind: "run",
      title: `Abrir ${branch} a partir da ${config.develop}`,
      command: "git",
      args: ["flow", "release", "start", next],
      recovery: `Nada mudou nas branches principais. Se ${branch} chegou a ser criada: git checkout ${config.develop} && git flow release delete --force ${next}`,
    },
    {
      id: "version",
      kind: "set-version",
      title: `Versão ${next} no package.json`,
      version: next,
      recovery: insideRelease,
    },
    {
      id: "changelog",
      kind: "changelog",
      title: "Gerar o CHANGELOG.md",
      tag,
      recovery: insideRelease,
    },
    {
      id: "commit",
      kind: "run",
      title: `Commit "chore(release): ${tag}"`,
      command: "git",
      args: ["commit", "-m", `chore(release): ${tag}`, "--", ...files],
      recovery: insideRelease,
    },
    {
      id: "finish",
      kind: "run",
      title: `Fechar o release: merge na ${config.main}, tag ${tag} e volta para a ${config.develop}`,
      command: "git",
      args: ["flow", "release", "finish", next, "--message", tag, "--no-push"],
      recovery: `Se parou num conflito de merge: resolva, faça git add e rode de novo: git flow release finish ${next} --message ${tag} --no-push`,
    },
    {
      // O finish termina na branch de produção; o trabalho continua na de integração.
      id: "checkout",
      kind: "run",
      title: `Voltar para a ${config.develop}`,
      command: "git",
      args: ["checkout", config.develop],
      recovery: `O release está completo localmente. Volte com git checkout ${config.develop} e envie: git ${pushArgs.join(" ")}`,
    },
    {
      id: "push",
      kind: "run",
      title: `Enviar ${config.main}, ${config.develop} e ${tag} para ${remote}`,
      command: "git",
      args: pushArgs,
      recovery: `O release está completo localmente; falta só enviar: git ${pushArgs.join(" ")}`,
    },
  ];

  return { version: next, tag, branch, steps };
}
