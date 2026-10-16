import type { SetupDisclosure } from "#src/usecases"
import {
  CHAT_MODELS_DISCLOSURE,
  DISCLOSURE_CONFIRM_LINE,
  JEV_DISCLOSURE,
  REMOTE_EMBEDDINGS_DISCLOSURE,
} from "./constants.ts"

export function disclosureText(disclosures: SetupDisclosure[]): string {
  return [...disclosures.map(disclosureLine), DISCLOSURE_CONFIRM_LINE].join("\n")
}

function disclosureLine(disclosure: SetupDisclosure): string {
  switch (disclosure) {
    case "chat-models":
      return CHAT_MODELS_DISCLOSURE
    case "jev":
      return JEV_DISCLOSURE
    case "remote-embeddings":
      return REMOTE_EMBEDDINGS_DISCLOSURE
  }
}
