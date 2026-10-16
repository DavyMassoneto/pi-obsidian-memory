# Maestro notes
- Large multi-line heredocs and `node -e` with `\n` get mangled or truncated in the Bash tool; use Write/Edit for big files. No python on this box.
- Biome bans `=== undefined/null` (also `typeof x === "undefined"`), `??`, ternaries: use `typeof x !== "string"` or `if`. Tests are exempt from types-file/constants rules but not from these.
- pi layer: ExtensionRegistrar is a narrow interface (registerTool/registerCommand/onSessionStart/onSessionShutdown); `registrarFor(pi)` adapts the real API. Narrow `MemoryPiContext` (src/pi/context) lets the fake pi avoid the huge real context.
- Intra-pi imports go through folder barrels (`#src/pi/<folder>`), never the `#src/pi` root (circular).
- extension.test mention guard: bare command names (`memory-setup`) match its regex, so the registered list holds both `name` and `/name`.
- After a registration usecase succeeds the session stamp is invalidated: a second usecase call in the same test needs `{...context, stamp: context.session.stamp()}`.
- pi `notify` is a no-op without UI (runner.js noOpUIContext); still guard with ctx.hasUI.
