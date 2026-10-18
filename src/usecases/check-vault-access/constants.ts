export const NO_FILE_ID = "0"

export const POSIX_PROCESS_RELATIVE_PATH = /^\/(?:proc\/(?:self\/fd|\d+\/root)|dev\/fd)(?:\/|$)/

export const NAMESPACE_PATH_START = /^\\\\[?.]\\/

export const NAMED_FILE_UNDER_ROOT = /^\\\\[?.]\\(?:[a-z]:|UNC|Volume\{[^}]+\})\\[^\\]/i
