import { describe, expect, test } from "vitest"

import { executedFiles } from "#src/domain"
import { runsPackageScript, runsScript } from "#test-helpers"

describe("executedFiles runs of an interpreter", () => {
  test.each([
    ["node write.js", "write.js"],
    ["node --no-warnings write.js arg", "write.js"],
    ["node ./scripts/write.mjs", "./scripts/write.mjs"],
    ["tsx write.ts", "write.ts"],
    ["ts-node write.ts", "write.ts"],
    ["bun write.ts", "write.ts"],
    ["bun run write.ts", "write.ts"],
    ["deno run --allow-write write.ts", "write.ts"],
    ["python write.py", "write.py"],
    ["python3 write.py", "write.py"],
    ["python -u write.py", "write.py"],
    ["py write.py", "write.py"],
    ["bash run.sh", "run.sh"],
    ["sh run.sh -x", "run.sh"],
    ["bash -x run.sh", "run.sh"],
    ["pwsh -NoProfile -File run.ps1", "run.ps1"],
    ["pwsh -f run.ps1", "run.ps1"],
    ["powershell -ExecutionPolicy Bypass -File .\\run.ps1", ".\\run.ps1"],
    ["POWERSHELL -file run.ps1", "run.ps1"],
    ["node.exe write.js", "write.js"],
    ["C:\\tools\\node.exe write.js", "write.js"],
    ["/usr/bin/python write.py", "write.py"],
    ["deno run --allow-write=out write.ts", "write.ts"],
    ["deno run --allow-read=. write.ts", "write.ts"],
    ["node --env-file=.env x.js", "x.js"],
    ["deno run -c deno.json write.ts", "write.ts"],
    ["deno run --config deno.json write.ts", "write.ts"],
    ["bun -c bunfig.toml write.ts", "write.ts"],
    ["bash -e run.sh", "run.sh"],
    ["bash -p run.sh", "run.sh"],
    ["bash -m run.sh", "run.sh"],
    ["bash -C run.sh", "run.sh"],
  ])("%s runs %s", (command, path) => {
    expect(executedFiles(command)).toEqual([runsScript(path)])
  })

  test("a quoted script path with spaces stays one path", () => {
    expect(executedFiles('node "my scripts/write file.js"')).toEqual([runsScript("my scripts/write file.js")])
  })

  test("a script preloaded with -r or --import runs before the main one", () => {
    expect(executedFiles("node -r ./setup.js --import ./hook.mjs write.js")).toEqual([
      runsScript("./setup.js"),
      runsScript("./hook.mjs"),
      runsScript("write.js"),
    ])
  })

  test("a script preloaded with --require runs before the main one", () => {
    expect(executedFiles("node --require ./w.js x.js")).toEqual([runsScript("./w.js"), runsScript("x.js")])
  })

  test("a script preloaded before inline code still runs", () => {
    expect(executedFiles("node -r a.js -e code")).toEqual([runsScript("a.js")])
  })

  test.each([
    "node --check x.js",
    "node -c x.js",
    "node --print 1",
    "tsx -e code",
    "ts-node --print 1",
    "bun -e code",
    "bun --print 1",
    'sh -c "echo hi > a"',
    "node -e \"require('fs').writeFileSync('a', 'b')\"",
    "node --eval code",
    "node -p 1",
    "python -c \"open('a','w')\"",
    'bash -c "echo hi > a"',
    'powershell -Command "Set-Content a b"',
    "pwsh -c Get-Date",
    "python -m http.server",
    "node",
    "deno fmt write.ts",
  ])("adds no file: %s", (command) => {
    expect(executedFiles(command)).toEqual([])
  })

  test("a form outside the design adds no file: zsh run.sh", () => {
    expect(executedFiles("zsh run.sh")).toEqual([])
  })
})

describe("executedFiles direct runs", () => {
  test.each([
    ["./run.sh", "./run.sh"],
    [".\\run.ps1", ".\\run.ps1"],
    ["& .\\run.ps1", ".\\run.ps1"],
    ["& '.\\my run.ps1'", ".\\my run.ps1"],
  ])("%s runs %s", (command, path) => {
    expect(executedFiles(command)).toEqual([runsScript(path)])
  })

  test.each(["scripts/write.js", "./build.cmd", "run.bat", "cat run.sh", "git add write.js", "eslint write.js"])(
    "%s runs no script",
    (command) => {
      expect(executedFiles(command)).toEqual([])
    },
  )
})

describe("executedFiles package scripts", () => {
  test.each([
    ["npm run build", "build"],
    ["npm run build -- --watch", "build"],
    ["npm run --silent build", "build"],
    ["npm run-script build", "build"],
    ["npm test", "test"],
    ["npm start", "start"],
    ["pnpm run lint", "lint"],
    ["pnpm test", "test"],
    ["yarn run fix", "fix"],
    ["yarn start", "start"],
  ])("%s runs the package script %s", (command, name) => {
    expect(executedFiles(command)).toEqual([runsPackageScript(name)])
  })

  test.each(["npm install", "npm ci", "pnpm add left-pad", "yarn", "npm run", "npm publish"])(
    "%s runs no package script",
    (command) => {
      expect(executedFiles(command)).toEqual([])
    },
  )
})

describe("executedFiles chained commands", () => {
  test.each([
    ["cd app && node write.js", [runsScript("write.js")]],
    ["node a.js; node b.js", [runsScript("a.js"), runsScript("b.js")]],
    ["node a.js | node b.js", [runsScript("a.js"), runsScript("b.js")]],
    ["npm run build && node write.js", [runsPackageScript("build"), runsScript("write.js")]],
    ["FOO=1 node write.js", [runsScript("write.js")]],
    ['FOO="a b" node x.js', [runsScript("x.js")]],
    ["FOO='a b' BAR=1 node x.js", [runsScript("x.js")]],
  ])("%j", (command, expected) => {
    expect(executedFiles(command)).toEqual(expected)
  })

  test("a separator inside quotes does not split the command", () => {
    expect(executedFiles('echo "a && node x.js"')).toEqual([])
    expect(executedFiles("node 'a;b.js'")).toEqual([runsScript("a;b.js")])
  })

  test("lists each file once, in the order first met", () => {
    expect(executedFiles("node a.js && node b.js && node a.js")).toEqual([runsScript("a.js"), runsScript("b.js")])
  })
})

describe("executedFiles with no script", () => {
  test.each(["", "   ", "ls -la", "git status", "echo hello > out.txt", "cat a.js | wc -l", "eslint --fix src"])(
    "%j runs nothing",
    (command) => {
      expect(executedFiles(command)).toEqual([])
    },
  )
})
