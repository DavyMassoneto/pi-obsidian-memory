import { NAMESPACE_VOLUME_ROOT } from "./constants.ts"

export function isNamespaceVolumeRoot(path: string): boolean {
  return NAMESPACE_VOLUME_ROOT.test(path)
}
