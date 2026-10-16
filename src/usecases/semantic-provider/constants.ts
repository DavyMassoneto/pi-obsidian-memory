import { checkLocalModel, createLocalSemantic } from "./local.ts"
import type { LocalModelAccess } from "./types.ts"

export const LOCAL_MODEL_SOURCE = "huggingface.co"

export const BYTES_PER_MEGABYTE = 1_000_000

export const localModelAccess: LocalModelAccess = { check: checkLocalModel, create: createLocalSemantic }
