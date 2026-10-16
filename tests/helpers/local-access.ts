import type { LocalModelAccess, LocalModelStatus, LocalSemanticOptions } from "#src/usecases"

export interface RecordedLocal {
  access: LocalModelAccess
  created: LocalSemanticOptions[]
}

export function recordingLocalAccess(status: LocalModelStatus): RecordedLocal {
  const created: LocalSemanticOptions[] = []
  const access: LocalModelAccess = {
    check: async () => status,
    create(options) {
      created.push(options)
      return {
        port: { available: true, embed: async () => ({ succeeded: false, status: "unavailable" }) },
        dispose: async () => {},
      }
    },
  }
  return { access, created }
}

export function offlineLocalAccess(): LocalModelAccess {
  return recordingLocalAccess("cached").access
}
