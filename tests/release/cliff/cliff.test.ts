import { copyFileSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { bumpedVersion, previewChangelog, writeChangelog } from "../../../scripts/release/cliff/cliff.ts"
import { cleanupTempDirs, commit, git, REPO_ROOT, tag, tempDir } from "../helpers.ts"

afterEach(cleanupTempDirs)

function repoWithProjectCliffConfig(): string {
  const dir = tempDir()
  git(dir, "init", "-q", "-b", "main")
  copyFileSync(join(REPO_ROOT, "cliff.toml"), join(dir, "cliff.toml"))
  return dir
}

function repoAt(version: string, ...messages: string[]): string {
  const dir = repoWithProjectCliffConfig()
  commit(dir, "chore: base")
  tag(dir, `v${version}`)
  for (const message of messages) commit(dir, message)
  return dir
}

describe("bumpedVersion", () => {
  it("sem nenhuma tag, usa a versão inicial 0.0.1", async () => {
    const dir = repoWithProjectCliffConfig()
    commit(dir, "docs: início")

    expect(await bumpedVersion(dir, "auto", "v")).toBe("0.0.1")
  })

  it.each([
    ["fix: corrige", "0.1.1"],
    ["perf: acelera", "0.1.1"],
    ["feat: novidade", "0.2.0"],
    ["feat!: quebra (em 0.x sobe o minor)", "0.2.0"],
    ["docs: só documentação", "0.1.0"],
  ])("depois de v0.1.0, %j → %s", async (message, expected) => {
    expect(await bumpedVersion(repoAt("0.1.0", message), "auto", "v")).toBe(expected)
  })

  it("a partir de 1.0, quebra sobe o major", async () => {
    expect(await bumpedVersion(repoAt("1.2.3", "feat!: nova API"), "auto", "v")).toBe("2.0.0")
  })

  it("--bump força o incremento", async () => {
    expect(await bumpedVersion(repoAt("0.1.0", "docs: só documentação"), "patch", "v")).toBe("0.1.1")
  })
})

describe("changelog", () => {
  it("agrupa por tipo, formata escopos e ignora commits de release", async () => {
    const dir = repoAt(
      "0.1.0",
      "feat(busca): busca semântica",
      "fix: corrige acentuação",
      "chore(release): v0.1.1",
      "docs: guia de instalação",
    )

    const preview = await previewChangelog(dir, "v0.2.0")

    expect(preview).toMatch(/^## \[0\.2\.0\] - \d{4}-\d{2}-\d{2}/)
    expect(preview).toContain("### Novidades")
    expect(preview).toContain("**busca:** Busca semântica")
    expect(preview).toContain("### Correções")
    expect(preview).toContain("### Manutenção")
    expect(preview).not.toContain("chore(release)")
    expect(preview).not.toContain("# Changelog")
  })

  it("regenera o CHANGELOG.md com o cabeçalho", async () => {
    const dir = repoAt("0.1.0", "feat: novidade")

    await writeChangelog(dir, "v0.2.0")

    const text = readFileSync(join(dir, "CHANGELOG.md"), "utf8")
    expect(text.startsWith("# Changelog")).toBe(true)
    expect(text).toContain("## [0.2.0]")
    expect(text).toContain("## [0.1.0]")
  })

  it("explica a falha do git-cliff", async () => {
    await expect(previewChangelog(tempDir(), "v0.2.0")).rejects.toThrow(/git-cliff falhou: .+/)
  })
})
