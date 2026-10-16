export type {
  ChatModelReference,
  ConfigFields,
  ConfigRepairDraft,
  InitProposal,
  MemoryConfig,
  ParseConfigResult,
  ProjectEntry,
  ResolveProjectResult,
  SetupDisclosure,
  SetupProposal,
} from "#src/domain"
export {
  inspectConfigForRepair,
  prepareSetupDefaults,
  proposeInit,
  proposeSetup,
  resolveProject,
  setupDisclosures,
} from "#src/domain"
export { checkConfigSnapshot } from "./publication.ts"
