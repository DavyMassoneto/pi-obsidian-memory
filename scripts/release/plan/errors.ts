export class NothingToRelease extends Error {
  constructor(currentVersion: string, nextVersion: string) {
    super(
      `nothing to release: the calculated next version (${nextVersion}) is not greater than the current one (${currentVersion}). ` +
        "There are only commits that do not change the version (docs, chore, ci…); to release anyway, use --bump patch.",
    )
    this.name = "NothingToRelease"
  }
}
