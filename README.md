# pi-obsidian-memory

Long-term memory for the [pi coding agent](https://pi.dev), stored in [Obsidian](https://obsidian.md) vaults.

> **Status:** early development. `memory_add` saves explicit requests to remember in configured global/project
> vaults and refreshes folder indexes. A saved note remains success with a warning if filesystem maintenance fails.
> Configure memory manually at `pi-obsidian-memory/config.json` in the pi agent directory. Startup is silent;
> setup/init, reading/search, update and lifecycle tools are not registered yet.

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
