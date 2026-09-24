export class NothingToRelease extends Error {
  constructor(currentVersion: string, nextVersion: string) {
    super(
      `nada para lançar: a próxima versão calculada (${nextVersion}) não é maior que a atual (${currentVersion}). ` +
        "Só há commits que não mudam a versão (docs, chore, ci…); para lançar mesmo assim, use --bump patch.",
    )
    this.name = "NothingToRelease"
  }
}
