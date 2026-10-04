# Config

One local JSON file on the machine, outside the vaults (`~/.pi/agent/pi-obsidian-memory/config.json`). Written by
`/memory-setup` and `/memory-init`; the user may edit it by hand.

```json
{
  "global": { "vault": "C:/Users/me/OneDrive/Obsidian/Global memory" },
  "projects": [
    { "name": "loja", "folder": "D:/Projects/loja", "vault": "C:/Users/me/OneDrive/Obsidian/loja" }
  ],
  "limits": { "maxBodyChars": 1000, "maxStatementChars": 100 }
}
```

- Every key is always written, defaults included, so every value in effect is visible in the file. A missing key makes
  the file invalid; nothing is filled in by the code.
- No file: there is no memory, and the extension offers `/memory-setup`.
- Invalid file (a missing key, a wrong type, a limit below 1, an empty path, an unknown key): nothing from it is used,
  and every problem is shown at once.
- A vault is named after its folder (`.../Global memory` is "Global memory").

## Which project a folder belongs to

pi runs in a folder; the project is the registered one whose folder contains it.

| pi runs in | Project |
|---|---|
| `D:/Projects/loja` | `loja` (exact folder) |
| `D:/Projects/loja/src/api` | `loja` (inside it) |
| `D:/Projects/loja/admin/src` | `loja-admin`, when it is registered too: the most specific folder wins |
| `d:\projects\LOJA\` | `loja`: case, separators and a trailing separator do not matter |
| `D:/Projects/lojas` | none: starting with the same letters is not being inside |
| `D:/Downloads` | none: only global memory |
