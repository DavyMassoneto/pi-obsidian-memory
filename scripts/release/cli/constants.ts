export const REMOTE = "origin"

export const RELEASE_FILES = ["package.json", "package-lock.json", "CHANGELOG.md"]

export const USAGE = `Usage: npm run release -- [options]

  --dry-run          show the plan and the changelog without changing anything
  --bump <type>      auto | patch | minor | major (auto when omitted: the version comes from the commits)
  -y, --yes          do not ask for confirmation (only with explicit authorization)
  -h, --help         show this help`
