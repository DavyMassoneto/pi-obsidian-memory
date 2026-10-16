# pi-obsidian-memory

Long-term memory for the [pi coding agent](https://pi.dev), stored in [Obsidian](https://obsidian.md) vaults.

> **Status:** early development. `/memory-setup` chooses or attaches the global vault and writes the config
> (`pi-obsidian-memory/config.json` in the pi agent directory); `/memory-init` registers a working folder as a
> project with its own vault. Session start says when memory is not configured or the config is invalid
> or unreadable. `/memory-doctor` reports problems in the vaults and config and offers to complete blank notes after
> confirmation; `/memory-export` writes both vaults to a new `.zip`; setup writes a `Memory.base` dashboard.
> `memory_add`
> saves explicit requests to remember in the configured global/project vaults and refreshes folder indexes; a saved
> note remains success with a warning if filesystem maintenance fails. `memory_search` and `memory_get` search and
> read the vaults, and session start loads every Don't forget note. `memory_update`, `memory_archive` and `memory_succeed`
> change notes only on an explicit request, after `memory_get` of the same note in the session, and refuse a note
> changed on disk since; archiving moves to `archive/`, never deletes. Automatic capture reviews the conversation in the background at the configured `capture.when` moment, asking
> when unsure. Semantic search is in: `memory_search` fuses words and
> vectors (local model by default), falling back to words when it is off. Each user message adds the relevant notes
> when the decision model (Laya locally, or Jev) says memory is needed, and session start loads relevant notes within
> the budget; `/memory-doctor` checks the decision model. Not yet: blocking the LLM's other routes to vault files.

See [docs/VISION.md](docs/VISION.md) for what this project is and the decisions behind it.

## Development

Tested with pi `1.0.1` and TypeBox `1.3.34`, pinned as development dependencies. Pi provides both at runtime;
following its package contract, they are wildcard peers, not bundled runtime dependencies.

```bash
npm install
npm run lint
npm run typecheck
npm test           # unit and integration tests
npm run test:pi    # smoke test in the real pi
pi -e ./src/pi/extension.ts
```

## License

[MIT](LICENSE)
