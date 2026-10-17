export interface FixtureFile {
  path: string
  text: string
}

export const SHELL_EDIT_FIXTURE_FILES: FixtureFile[] = [
  { path: "src.txt", text: "old line\n" },
  { path: "config.ini", text: "a=1\n" },
  { path: "old.txt", text: "old\n" },
  { path: "a.txt", text: "a\n" },
  { path: "archive/keep.txt", text: "keep\n" },
  { path: "write.js", text: 'require("fs").writeFileSync("written.txt", "x")\n' },
  { path: "read.js", text: 'console.log(require("fs").readFileSync("src.txt", "utf8"))\n' },
  { path: "write.py", text: 'open("written.txt", "w").write("x")\n' },
  { path: "read.py", text: 'print(open("src.txt").read())\n' },
  {
    path: "package.json",
    text: JSON.stringify({
      scripts: {
        test: "vitest run",
        lint: "biome check .",
        format: "biome check --write .",
        gen: `node -e "require('fs').writeFileSync('gen.txt','x')"`,
      },
    }),
  },
]
