import type { MemoryConfig } from "#/domain/config"

export function aConfig(): MemoryConfig {
  return {
    global: { vault: "C:/Users/Administrator/OneDrive/Obisidian/Global memory" },
    projects: [
      { name: "loja", folder: "D:/Projects/loja", vault: "C:/vaults/loja" },
      { name: "loja-admin", folder: "D:/Projects/loja/admin", vault: "C:/vaults/loja-admin" },
    ],
    limits: { maxBodyChars: 1000, maxStatementChars: 100 },
  }
}
