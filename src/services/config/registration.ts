export type {
  ChatModelReference,
  ConfigFields,
  ConfigRepairDraft,
  InitProposal,
  MemoryConfig,
  ParseConfigResult,
  ProjectEntry,
  ResolveProjectResult,
  SettingChange,
  SettingNumberKind,
  SettingNumberResult,
  SetupDisclosure,
  SetupProposal,
} from "#src/domain"
export {
  changeSetting,
  inspectConfigForRepair,
  parseSettingNumber,
  prepareSetupDefaults,
  proposeInit,
  proposeSetup,
  resolveProject,
  setupDisclosures,
} from "#src/domain"
export { checkConfigSnapshot } from "./publication.ts"
