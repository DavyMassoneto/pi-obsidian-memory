import { existsSync } from "node:fs";
import { join } from "node:path";
import { git } from "./git.ts";

/** O que o release precisa saber do Git Flow, lido do `.gitflow` versionado. */
export interface GitFlowConfig {
  /** Branch de produção: tipo `base`, sem pai (ex.: `main`). */
  readonly main: string;
  /** Branch de integração: tipo `base`, filha da de produção (ex.: `dev`). */
  readonly develop: string;
  /** Prefixo das branches de release (ex.: `release/`). */
  readonly releasePrefix: string;
  /** Prefixo das tags de versão (ex.: `v`). Vazio se não configurado. */
  readonly tagPrefix: string;
}

export const GITFLOW_FILE = ".gitflow";

/** Lê o `.gitflow` do repositório em `cwd`. */
export function readGitFlowConfig(cwd: string): GitFlowConfig {
  const file = join(cwd, GITFLOW_FILE);
  if (!existsSync(file)) {
    throw new Error(`${GITFLOW_FILE} não encontrado em ${cwd}: rode "git flow init --shared"`);
  }
  return parseGitFlowConfig(git(cwd, ["config", "--file", file, "--list"]));
}

/** Interpreta a saída de `git config --list` (uma linha `chave=valor` por vez). */
export function parseGitFlowConfig(listing: string): GitFlowConfig {
  const branches = new Map<string, Map<string, string>>();
  for (const line of listing.split(/\r?\n/)) {
    const groups = /^gitflow\.branch\.(?<name>.+)\.(?<key>[^.=]+)=(?<value>.*)$/.exec(line)?.groups;
    if (groups?.name === undefined || groups.key === undefined || groups.value === undefined) continue;
    const props = branches.get(groups.name) ?? new Map<string, string>();
    props.set(groups.key.toLowerCase(), groups.value);
    branches.set(groups.name, props);
  }

  const bases = [...branches].filter(([, props]) => props.get("type") === "base");
  const main = bases.find(([, props]) => !props.has("parent"))?.[0];
  const develop = bases.find(([, props]) => main !== undefined && props.get("parent") === main)?.[0];
  const release = branches.get("release");
  const releasePrefix = release?.get("prefix");

  if (main === undefined) throw new Error(`${GITFLOW_FILE}: nenhuma branch base sem pai (a de produção)`);
  if (develop === undefined) throw new Error(`${GITFLOW_FILE}: nenhuma branch base filha de ${main} (a de integração)`);
  if (releasePrefix === undefined) throw new Error(`${GITFLOW_FILE}: prefixo das branches de release não configurado`);

  return { main, develop, releasePrefix, tagPrefix: release?.get("tagprefix") ?? "" };
}
