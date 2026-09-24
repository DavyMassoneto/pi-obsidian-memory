import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { isBump, isNewerVersion, parseVersion, readPackageVersion, setPackageVersion } from "#scripts"
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

describe("isNewerVersion", () => {
  it("compara numericamente, não como texto", () => {
    expect(isNewerVersion("0.10.0", "0.9.9")).toBe(true)
    expect(isNewerVersion("1.0.0", "1.0.1")).toBe(false)
  })

  it("decide pela parte mais significativa que muda", () => {
    expect(isNewerVersion("2.0.0", "1.9.9")).toBe(true)
    expect(isNewerVersion("1.2.0", "1.1.9")).toBe(true)
  })

  it("versão igual não é mais nova", () => {
    expect(isNewerVersion("2.3.4", "2.3.4")).toBe(false)
  })
})

describe("isBump", () => {
  it("aceita só os incrementos conhecidos", () => {
    expect(["patch", "minor", "major"].every(isBump)).toBe(true)
    expect(isBump("auto")).toBe(false)
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
    writeFileSync(join(dir, "package-lock.json"), lock("0.0.0").replaceAll("\n", "\r\n"))

    setPackageVersion(dir, "0.0.1")

    expect(readFileSync(join(dir, "package.json"), "utf8")).toBe(pkg("0.0.1").replaceAll("\n", "\r\n"))
    expect(readFileSync(join(dir, "package-lock.json"), "utf8")).toBe(lock("0.0.1").replaceAll("\n", "\r\n"))
  })

  it("exige o package-lock.json, sem alterar o package.json", () => {
    const dir = tempDir()
    writeFileSync(join(dir, "package.json"), pkg("0.0.0"))

    expect(() => setPackageVersion(dir, "1.0.0")).toThrow(/package-lock\.json/)
    expect(readFileSync(join(dir, "package.json"), "utf8")).toBe(pkg("0.0.0"))
  })

  it("recusa versão inválida sem alterar nada", () => {
    const dir = tempDir()
    writeFileSync(join(dir, "package.json"), pkg("0.0.0"))
    writeFileSync(join(dir, "package-lock.json"), lock("0.0.0"))

    expect(() => setPackageVersion(dir, "1.0")).toThrow(/versão inválida/)
    expect(readFileSync(join(dir, "package.json"), "utf8")).toBe(pkg("0.0.0"))
    expect(readFileSync(join(dir, "package-lock.json"), "utf8")).toBe(lock("0.0.0"))
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
