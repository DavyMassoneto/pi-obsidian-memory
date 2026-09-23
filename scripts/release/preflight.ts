import { git, tryGit } from "./git.ts";
import type { GitFlowConfig } from "./gitflow.ts";
import { readPackageVersion } from "./version.ts";

export interface PreflightContext {
  readonly cwd: string;
  readonly config: GitFlowConfig;
  readonly remote: string;
}

/** Uma verificação: devolve o problema encontrado, ou `undefined` se está tudo certo. Nenhuma altera o repositório. */
export type Check = (ctx: PreflightContext) => string | undefined;

export const gitFlowInstalled: Check = ({ cwd }) =>
  tryGit(cwd, ["flow", "version"]) === undefined
    ? "git-flow não encontrado: instale o git-flow-next (winget install GitTower.GitFlowNext)"
    : undefined;

export const onDevelopBranch: Check = ({ cwd, config }) => {
  const current = git(cwd, ["branch", "--show-current"]);
  return current === config.develop
    ? undefined
    : `rode o release a partir da ${config.develop} (branch atual: ${current || "HEAD destacado"})`;
};

export const cleanWorkingTree: Check = ({ cwd }) =>
  git(cwd, ["status", "--porcelain"]) === "" ? undefined : "há mudanças não commitadas";

export const noOpenRelease: Check = ({ cwd, config }) => {
  const open = git(cwd, ["branch", "--list", `${config.releasePrefix}*`, "--format=%(refname:short)"]);
  return open === "" ? undefined : `já existe release aberta (${open.split(/\r?\n/).join(", ")}): termine ou apague antes`;
};

/** A branch local e a do remoto apontam para o mesmo commit (consulta com ls-remote, sem fetch). */
export function inSyncWithRemote(which: "main" | "develop"): Check {
  return ({ cwd, config, remote }) => {
    const branch = config[which];
    const local = tryGit(cwd, ["rev-parse", "--verify", `refs/heads/${branch}`]);
    if (local === undefined) return `a branch ${branch} não existe localmente`;
    const listing = tryGit(cwd, ["ls-remote", remote, `refs/heads/${branch}`]);
    if (listing === undefined) return `não foi possível consultar ${remote} (sem rede ou remoto inexistente)`;
    const remoteSha = listing.split(/\s+/)[0];
    if (!remoteSha) return `a branch ${branch} não existe em ${remote}`;
    return local === remoteSha
      ? undefined
      : `${branch} local (${local.slice(0, 7)}) difere de ${remote}/${branch} (${remoteSha.slice(0, 7)}): sincronize antes`;
  };
}

/** A versão do package.json é a da última tag (se já houver alguma). */
export const versionMatchesLatestTag: Check = ({ cwd, config }) => {
  const tag = tryGit(cwd, ["describe", "--tags", "--abbrev=0", "--match", `${config.tagPrefix}[0-9]*`]);
  if (tag === undefined) return undefined;
  const version = readPackageVersion(cwd);
  return tag === `${config.tagPrefix}${version}`
    ? undefined
    : `o package.json (${version}) não bate com a última tag (${tag})`;
};

export const CHECKS: readonly Check[] = [
  gitFlowInstalled,
  onDevelopBranch,
  cleanWorkingTree,
  noOpenRelease,
  inSyncWithRemote("develop"),
  inSyncWithRemote("main"),
  versionMatchesLatestTag,
];

/** Roda as verificações e devolve os problemas encontrados (lista vazia = pode seguir). */
export function runPreflight(ctx: PreflightContext, checks: readonly Check[] = CHECKS): string[] {
  return checks.map((check) => check(ctx)).filter((problem) => problem !== undefined);
}
