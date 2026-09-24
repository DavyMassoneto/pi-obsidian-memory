import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { isNewerVersion, parseVersion, readPackageVersion, setPackageVersion } from "#scripts"
import { cleanupTempDirs, tempDir } from "../helpers.ts"

afterEach(cleanupTempDirs)

const pkg = (version: string) => `{\n  "name": "demo",\n  "version": "${version}"\n}\n`

const lock = (version: string) =>
  `{\n  "name": "demo",\n  "version": "${version}",\n  "lockfileVersion": 3,\n  "packages": {\n    "": {\n      "name": "demo",\n      "version": "${version}"\n    }\n  }\n}\n`

describe("parseVersion", () => {
  it("accepts X.Y.Z", () => {
    expect(parseVersion("1.20.3")).toEqual({ major: 1, minor: 20, patch: 3 })
  })

  it.each(["1.2", "01.2.3", "1.2.3-beta.1", "v1.2.3", ""])("rejects %j", (version) => {
    expect(() => parseVersion(version)).toThrow(/invalid version/)
  })
})

describe("isNewerVersion", () => {
  it("compares numerically, not as text", () => {
    expect(isNewerVersion("0.10.0", "0.9.9")).toBe(true)
    expect(isNewerVersion("1.0.0", "1.0.1")).toBe(false)
  })

  it("decides by the most significant part that changes", () => {
    expect(isNewerVersion("2.0.0", "1.9.9")).toBe(true)
    expect(isNewerVersion("1.2.0", "1.1.9")).toBe(true)
  })

  it("an equal version is not newer", () => {
    expect(isNewerVersion("2.3.4", "2.3.4")).toBe(false)
  })
})

describe("setPackageVersion", () => {
  it("updates package.json and package-lock.json keeping the formatting", () => {
    const dir = tempDir()
    writeFileSync(join(dir, "package.json"), pkg("0.0.0"))
    writeFileSync(join(dir, "package-lock.json"), lock("0.0.0"))

    setPackageVersion(dir, "0.1.0")

    expect(readFileSync(join(dir, "package.json"), "utf8")).toBe(pkg("0.1.0"))
    expect(readFileSync(join(dir, "package-lock.json"), "utf8")).toBe(lock("0.1.0"))
  })

  it("keeps CRLF line endings", () => {
    const dir = tempDir()
    writeFileSync(join(dir, "package.json"), pkg("0.0.0").replaceAll("\n", "\r\n"))
    writeFileSync(join(dir, "package-lock.json"), lock("0.0.0").replaceAll("\n", "\r\n"))

    setPackageVersion(dir, "0.0.1")

    expect(readFileSync(join(dir, "package.json"), "utf8")).toBe(pkg("0.0.1").replaceAll("\n", "\r\n"))
    expect(readFileSync(join(dir, "package-lock.json"), "utf8")).toBe(lock("0.0.1").replaceAll("\n", "\r\n"))
  })

  it("requires package-lock.json, without touching package.json", () => {
    const dir = tempDir()
    writeFileSync(join(dir, "package.json"), pkg("0.0.0"))

    expect(() => setPackageVersion(dir, "1.0.0")).toThrow(/package-lock\.json/)
    expect(readFileSync(join(dir, "package.json"), "utf8")).toBe(pkg("0.0.0"))
  })

  it("rejects an invalid version without changing anything", () => {
    const dir = tempDir()
    writeFileSync(join(dir, "package.json"), pkg("0.0.0"))
    writeFileSync(join(dir, "package-lock.json"), lock("0.0.0"))

    expect(() => setPackageVersion(dir, "1.0")).toThrow(/invalid version/)
    expect(readFileSync(join(dir, "package.json"), "utf8")).toBe(pkg("0.0.0"))
    expect(readFileSync(join(dir, "package-lock.json"), "utf8")).toBe(lock("0.0.0"))
  })

  it("rejects a package-lock.json without the root package version", () => {
    const dir = tempDir()
    writeFileSync(join(dir, "package.json"), pkg("0.0.0"))
    writeFileSync(join(dir, "package-lock.json"), `{ "name": "demo", "version": "0.0.0", "packages": {} }\n`)

    expect(() => setPackageVersion(dir, "0.1.0")).toThrow(/package-lock\.json is not in the expected format/)
    expect(readFileSync(join(dir, "package.json"), "utf8")).toBe(pkg("0.0.0"))
  })
})

describe("readPackageVersion", () => {
  it("requires the version field", () => {
    const dir = tempDir()
    writeFileSync(join(dir, "package.json"), `{ "name": "demo" }\n`)

    expect(() => readPackageVersion(dir)).toThrow(/package\.json is not in the expected format: .*version/)
  })
})
