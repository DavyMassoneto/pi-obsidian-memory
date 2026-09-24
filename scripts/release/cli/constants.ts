export const REMOTE = "origin"

export const RELEASE_FILES = ["package.json", "package-lock.json", "CHANGELOG.md"]

export const USAGE = `Uso: npm run release -- [opções]

  --dry-run          mostra o plano e o changelog sem alterar nada
  --bump <tipo>      força o incremento: patch | minor | major (sem ele, a versão sai dos commits)
  -y, --yes          não pede confirmação (só com autorização explícita)
  -h, --help         mostra esta ajuda`
