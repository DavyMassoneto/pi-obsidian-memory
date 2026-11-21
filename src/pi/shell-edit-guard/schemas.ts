import Type from "typebox"

export const SessionKeyFlagsSchema = Type.Object({ shellEditGuard: Type.Optional(Type.Boolean()) })
