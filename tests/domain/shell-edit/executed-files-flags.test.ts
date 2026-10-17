import { describe, expect, test } from "vitest"

import { executedFiles } from "#src/domain"
import { runsPackageScript, runsPackageScriptIn, runsScript } from "#test-helpers"

describe("executedFiles skips the value of a flag that takes one", () => {
  test.each([
    ["node --conditions x write.js", "write.js"],
    ["node -C x write.js", "write.js"],
    ["node --title t write.js", "write.js"],
    ["node --env-file .env write.js", "write.js"],
    ["node --max-http-header-size 9000 --no-warnings write.js", "write.js"],
    ["python -X dev write.py", "write.py"],
    ["python3 -W ignore write.py", "write.py"],
    ["python --check-hash-based-pycs always write.py", "write.py"],
    ["py -X dev write.py", "write.py"],
    ["bash -o errexit run.sh", "run.sh"],
    ["sh -O extglob run.sh", "run.sh"],
    ["bash +o errexit run.sh", "run.sh"],
    ["bash --rcfile rc.sh run.sh", "run.sh"],
    ["bash --init-file init.sh run.sh", "run.sh"],
    ["tsx --tsconfig t.json write.ts", "write.ts"],
    ["tsx --conditions x write.ts", "write.ts"],
    ["ts-node --project t.json write.ts", "write.ts"],
    ["ts-node -P t.json write.ts", "write.ts"],
    ["ts-node --compiler-options {} write.ts", "write.ts"],
    ["bun --conditions x write.ts", "write.ts"],
    ["bun run --tsconfig-override t.json write.ts", "write.ts"],
    ["bun -d K:V write.ts", "write.ts"],
  ])("%s runs %s", (command, path) => {
    expect(executedFiles(command)).toEqual([runsScript(path)])
  })

  test("a value after an inline code flag is not a script", () => {
    expect(executedFiles("node --conditions x -e code")).toEqual([])
  })

  test.each([
    ["node --loader ts-node/esm x.ts", [runsScript("ts-node/esm"), runsScript("x.ts")]],
    ["node --experimental-loader ./l.mjs x.js", [runsScript("./l.mjs"), runsScript("x.js")]],
    ["tsx --loader ./l.mjs x.ts", [runsScript("./l.mjs"), runsScript("x.ts")]],
    ["bun --loader .js:jsx write.ts", [runsScript("write.ts")]],
  ])("%s", (command, expected) => {
    expect(executedFiles(command)).toEqual(expected)
  })

  test("a bun preload script still runs before the main one", () => {
    expect(executedFiles("bun --preload ./p.ts write.ts")).toEqual([runsScript("./p.ts"), runsScript("write.ts")])
  })
})

describe("executedFiles with bun run", () => {
  test.each(["build", "dev:server", "test.unit"])("bun run %s runs the package script", (name) => {
    expect(executedFiles(`bun run ${name}`)).toEqual([runsPackageScript(name)])
  })

  test.each(["write.ts", "./build", "scripts/build", "x.mjs", "x.sh"])("bun run %s runs the file", (path) => {
    expect(executedFiles(`bun run ${path}`)).toEqual([runsScript(path)])
  })

  test("bun with a file and no run keeps being read as a file", () => {
    expect(executedFiles("bun write.ts")).toEqual([runsScript("write.ts")])
  })
})

describe("executedFiles with an npm prefix", () => {
  test.each([
    ["npm --prefix app run build", runsPackageScriptIn("app", "build")],
    ["npm --prefix=app run build", runsPackageScriptIn("app", "build")],
    ["npm -C app test", runsPackageScriptIn("app", "test")],
    ["npm run build --prefix app", runsPackageScriptIn("app", "build")],
    ["npm --loglevel warn run build", runsPackageScript("build")],
    ["pnpm -w run build", runsPackageScript("build")],
    ["npm run build -- --prefix app", runsPackageScript("build")],
    ["pnpm run build", runsPackageScript("build")],
  ])("%s", (command, expected) => {
    expect(executedFiles(command)).toEqual([expected])
  })

  test("a prefix flag with no value adds no script", () => {
    expect(executedFiles("npm --prefix")).toEqual([])
  })

  test.each([
    "npm -w pkg run build",
    "npm --workspace pkg run build",
    "npm --workspace=pkg run build",
    "npm run build -w pkg",
    "npm -w pkg --prefix app run build",
  ])("%s runs a workspace script, which is not resolved", (command) => {
    expect(executedFiles(command)).toEqual([])
  })
})

describe("executedFiles with a bun folder flag", () => {
  test.each([
    ["bun run --cwd app build", runsPackageScriptIn("app", "build")],
    ["bun run --cwd=app build", runsPackageScriptIn("app", "build")],
    ["bun run build --cwd app", runsPackageScript("build")],
  ])("%s", (command, expected) => {
    expect(executedFiles(command)).toEqual([expected])
  })
})
