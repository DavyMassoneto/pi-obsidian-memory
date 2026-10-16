# indice notes
- 2026-xx: SearchIndex methods live in storage.ts (SqliteSearchIndex); each feature = *-statements.ts + *-storage.ts + public wrapper file + barrel line. Version bump = INDEX_SCHEMA_VERSION in constants.ts; mismatch test pattern: `changeIndexFile(path, "PRAGMA user_version = N-1")` then openIndex -> rebuilt true.
- TypeBox `Type` only importable in schemas.ts (lint). Don't run `biome check --write` on whole tests/ (reformats other owners' WIP); scope to own paths.
