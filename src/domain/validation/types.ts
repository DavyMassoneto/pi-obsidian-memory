import type { TValidationError } from "typebox/error"

export type ErrorMessageOverride = (error: TValidationError) => string | null
