import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { compareVersions, isBump, parseVersion, readPackageVersion, setPackageVersion } from "#scripts"
import { cleanupTempDirs, tempDir } from "../helpers.ts"

afterEach(cleanupTempDirs)

const pkg = (version: string) => `{\n  "name": "demo",\n  "version": "${version}"\n}\n`

const lock = (version: string) =>
  `{\n  "name": "demo",\n  "version": "${version}",\n  "lockfileVersion": 3,\n  "packages": {\n    "": {\n      "name": "demo",\n      "version": "${version}"\n    }\n  }\n}\n`

describe("parseVersion", () => {
  it("aceita X.Y.Z", () => {
    expect(parseVersion("1.20.3")).toEqual([1, 20, 3])
  })

  it.each(["1.2", "01.2.3", "1.2.3-beta.1", "v1.2.3", ""])("recusa %j", (version) => {
    expect(() => parseVersion(version)).toThrow(/versão inválida/)
  })
})

describe("compareVersions", () => {
  it("compara numericamente, não como texto", () => {
    expect(compareVersions("0.10.0", "0.9.9")).toBeGreaterThan(0)
    expect(compareVersions("1.0.0", "1.0.1")).toBeLessThan(0)
    expect(compareVersions("2.3.4", "2.3.4")).toBe(0)
  })
})

describe("isBump", () => {
  it("aceita só os incrementos conhecidos", () => {
    expect(["auto", "patch", "minor", "major"].every(isBump)).toBe(true)
    expect(isBump("prerelease")).toBe(false)
  })
})

describe("setPackageVersion", () => {
  it("atualiza package.json e package-lock.json preservando a formatação", () => {
    const dir = tempDir()
    writeFileSync(join(dir, "package.json"), pkg("0.0.0"))
    writeFileSync(join(dir, "package-lock.json"), lock("0.0.0"))

    setPackageVersion(dir, "0.1.0")

    expect(readFileSync(join(dir, "package.json"), "utf8")).toBe(pkg("0.1.0"))
    expect(readFileSync(join(dir, "package-lock.json"), "utf8")).toBe(lock("0.1.0"))
  })

  it("preserva finais de linha CRLF", () => {
    const dir = tempDir()
    writeFileSync(join(dir, "package.json"), pkg("0.0.0").replaceAll("\n", "\r\n"))

    setPackageVersion(dir, "0.0.1")

    expect(readFileSync(join(dir, "package.json"), "utf8")).toBe(pkg("0.0.1").replaceAll("\n", "\r\n"))
  })

  it("funciona sem package-lock.json", () => {
    const dir = tempDir()
    writeFileSync(join(dir, "package.json"), pkg("0.0.0"))

    setPackageVersion(dir, "1.0.0")

    expect(readPackageVersion(dir)).toBe("1.0.0")
  })

  it("recusa versão inválida sem alterar nada", () => {
    const dir = tempDir()
    writeFileSync(join(dir, "package.json"), pkg("0.0.0"))

    expect(() => setPackageVersion(dir, "1.0")).toThrow(/versão inválida/)
    expect(readFileSync(join(dir, "package.json"), "utf8")).toBe(pkg("0.0.0"))
  })

  it("recusa package-lock.json sem a versão do pacote raiz", () => {
    const dir = tempDir()
    writeFileSync(join(dir, "package.json"), pkg("0.0.0"))
    writeFileSync(join(dir, "package-lock.json"), `{ "name": "demo", "version": "0.0.0", "packages": {} }\n`)

    expect(() => setPackageVersion(dir, "0.1.0")).toThrow(/package-lock\.json fora do formato esperado/)
    expect(readFileSync(join(dir, "package.json"), "utf8")).toBe(pkg("0.0.0"))
  })
})

describe("readPackageVersion", () => {
  it("exige o campo version", () => {
    const dir = tempDir()
    writeFileSync(join(dir, "package.json"), `{ "name": "demo" }\n`)

    expect(() => readPackageVersion(dir)).toThrow(/package\.json fora do formato esperado: .*version/)
  })
})
