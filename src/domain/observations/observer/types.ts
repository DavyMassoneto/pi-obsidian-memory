import type { Static } from "typebox"

import type { Failed, Succeeded } from "#src/shared"
import type { ObserverDraftSchema } from "./schemas.ts"

export type ObserverDraft = Static<typeof ObserverDraftSchema>
export type ObserverReplyResult = Succeeded<ObserverDraft[]> | Failed
