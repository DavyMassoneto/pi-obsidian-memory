# pi-obsidian-memory

Long-term memory for the [pi coding agent](https://pi.dev), stored in [Obsidian](https://obsidian.md) vaults.

> **Status:** early development. The extension loads but has no features yet.

See [docs/VISION.md](docs/VISION.md) for what this project is and the decisions behind it.

## Development

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
