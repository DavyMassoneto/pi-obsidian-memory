import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Tipos de incremento aceitos; `auto` deixa o cliff.toml decidir pelos commits. */
export const BUMPS = ["auto", "patch", "minor", "major"] as const;
export type Bump = (typeof BUMPS)[number];

export function isBump(value: string): value is Bump {
  return (BUMPS as readonly string[]).includes(value);
}

/** Versão de release SemVer (`X.Y.Z`, sem pré-release nem build). */
export type Version = readonly [major: number, minor: number, patch: number];

const RELEASE_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function parseVersion(version: string): Version {
  const match = RELEASE_VERSION.exec(version);
  if (!match) throw new Error(`versão inválida: "${version}" (esperado X.Y.Z)`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** Negativo se `a < b`, zero se iguais, positivo se `a > b`. */
export function compareVersions(a: string, b: string): number {
  const [x, y] = [parseVersion(a), parseVersion(b)];
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
}

interface PackageJson {
  version?: unknown;
}

interface PackageLock {
  version?: unknown;
  packages?: Record<string, { version?: unknown }>;
}

export function readPackageVersion(dir: string): string {
  const { version } = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as PackageJson;
  if (typeof version !== "string") throw new Error("package.json sem o campo version");
  parseVersion(version);
  return version;
}

/** Atualiza a versão no package.json e, se existir, no package-lock.json, preservando a formatação do npm. */
export function setPackageVersion(dir: string, version: string): void {
  parseVersion(version);
  updateJson<PackageJson>(join(dir, "package.json"), (pkg) => {
    pkg.version = version;
  });
  const lockFile = join(dir, "package-lock.json");
  if (!existsSync(lockFile)) return;
  updateJson<PackageLock>(lockFile, (lock) => {
    lock.version = version;
    const root = lock.packages?.[""];
    if (root) root.version = version;
  });
}

function updateJson<T>(file: string, mutate: (data: T) => void): void {
  const original = readFileSync(file, "utf8");
  const data = JSON.parse(original) as T;
  mutate(data);
  const eol = original.includes("\r\n") ? "\r\n" : "\n";
  writeFileSync(file, JSON.stringify(data, null, 2).replaceAll("\n", eol) + eol);
}
