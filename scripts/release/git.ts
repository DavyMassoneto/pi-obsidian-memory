import { execFileSync } from "node:child_process";

/** Falha de um comando externo, com a saída de erro para diagnóstico. */
export class CommandError extends Error {
  readonly command: string;
  readonly stderr: string;

  constructor(command: string, stderr: string) {
    super(stderr ? `${command} falhou: ${stderr}` : `${command} falhou`);
    this.name = "CommandError";
    this.command = command;
    this.stderr = stderr;
  }
}

/** Roda `git` em silêncio e devolve a saída padrão sem espaços nas pontas. */
export function git(cwd: string, args: readonly string[]): string {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (error) {
    throw new CommandError(`git ${args.join(" ")}`, stderrOf(error));
  }
}

/** Como {@link git}, mas devolve `undefined` quando o comando falha. */
export function tryGit(cwd: string, args: readonly string[]): string | undefined {
  try {
    return git(cwd, args);
  } catch {
    return undefined;
  }
}

/**
 * Roda um comando com a saída visível no terminal (os passos do release).
 * Merges nunca abrem editor: as mensagens vêm por parâmetro.
 */
export function runVisible(cwd: string, command: string, args: readonly string[]): void {
  try {
    execFileSync(command, args, { cwd, stdio: "inherit", env: { ...process.env, GIT_MERGE_AUTOEDIT: "no" } });
  } catch (error) {
    throw new CommandError(`${command} ${args.join(" ")}`, stderrOf(error));
  }
}

function stderrOf(error: unknown): string {
  if (typeof error === "object" && error !== null && "stderr" in error) {
    const { stderr } = error as { stderr: unknown };
    if (stderr != null) return String(stderr).trim();
  }
  return error instanceof Error ? error.message : String(error);
}
