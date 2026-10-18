import {
  type ConfigInfrastructure,
  type ConfigRegistrations,
  changeSetting as changeSettingOn,
  type InitProposal,
  infrastructureProblems as infrastructureProblemsOn,
  inspectConfigForRepair as inspectConfigForRepairOn,
  type MemoryConfig,
  parseConfig as parseConfigOn,
  proposeInit as proposeInitOn,
  proposeSetup as proposeSetupOn,
  registrationProblems as registrationProblemsOn,
  type SettingChange,
  type SetupProposal,
} from "#src/domain"

export function parseConfig(text: string) {
  return parseConfigOn(text, "win32")
}

export function inspectConfigForRepair(text: string) {
  return inspectConfigForRepairOn(text, "win32")
}

export function changeSetting(config: MemoryConfig, change: SettingChange) {
  return changeSettingOn(config, change, "win32")
}

export function proposeSetup(request: SetupProposal) {
  return proposeSetupOn(request, "win32")
}

export function proposeInit(request: InitProposal) {
  return proposeInitOn(request, "win32")
}

export function registrationProblems(config: ConfigRegistrations) {
  return registrationProblemsOn(config, "win32")
}

export function infrastructureProblems(request: ConfigInfrastructure) {
  return infrastructureProblemsOn(request, "win32")
}
