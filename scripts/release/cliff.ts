import { runGitCliff, type Options as CliffOptions } from "git-cliff";
import type { Bump } from "./version.ts";

/** Próxima versão (sem o prefixo da tag), calculada pelo git-cliff com as regras do cliff.toml. */
export async function nextVersion(cwd: string, bump: Bump, tagPrefix: string): Promise<string> {
  const printed = await cliff(cwd, { bumpedVersion: true, ...(bump === "auto" ? {} : { bump }) });
  return tagPrefix && printed.startsWith(tagPrefix) ? printed.slice(tagPrefix.length) : printed;
}

/** Regenera o CHANGELOG.md inteiro, tratando as mudanças ainda não lançadas como `tag`. */
export async function writeChangelog(cwd: string, tag: string): Promise<void> {
  await cliff(cwd, { tag, output: "CHANGELOG.md" });
}

/** A seção que o release vai gerar, sem o cabeçalho (para o `--dry-run`). */
export async function previewChangelog(cwd: string, tag: string): Promise<string> {
  return cliff(cwd, { unreleased: true, tag, strip: "header" });
}

async function cliff(cwd: string, options: CliffOptions): Promise<string> {
  try {
    const result = await runGitCliff(options, { cwd, stdio: "pipe" });
    return String(result.stdout ?? "").trim();
  } catch (error) {
    const stderr = typeof error === "object" && error !== null && "stderr" in error ? String(error.stderr) : "";
    const reason = stderr.split(/\r?\n/).findLast((line) => line.trim() !== "") ?? String(error);
    throw new Error(`git-cliff falhou: ${reason.trim()}`);
  }
}
