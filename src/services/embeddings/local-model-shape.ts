import { types } from "node:util"

import type { SharedLocalModel } from "./types.ts"

export function isSharedLocalModel(value: object): value is SharedLocalModel {
  return (
    Object.getPrototypeOf(value) === Object.prototype &&
    Object.keys(value).length === 9 &&
    Object.values(Object.getOwnPropertyDescriptors(value)).every((descriptor) => descriptor.writable) &&
    hasOwnership(value) &&
    hasLoading(value) &&
    hasQueue(value)
  )
}

function hasOwnership(value: object): boolean {
  if (!("owners" in value && types.isMap(value.owners) && unmodifiedCollection(value.owners, Map.prototype))) {
    return false
  }
  for (const [owner, lifetime] of value.owners) {
    if (!(owner instanceof WeakRef && lifetime instanceof AbortController)) return false
  }
  return "finalizer" in value && value.finalizer instanceof FinalizationRegistry
}

function hasLoading(value: object): boolean {
  return (
    "model" in value &&
    nullablePromise(value.model) &&
    "loading" in value &&
    (Object.is(value.loading, null) || value.loading instanceof AbortController) &&
    "beforeLoad" in value &&
    types.isPromise(value.beforeLoad) &&
    "interests" in value &&
    types.isSet(value.interests) &&
    unmodifiedCollection(value.interests, Set.prototype) &&
    Array.from(value.interests).every((listener) => typeof listener === "function")
  )
}

function hasQueue(value: object): boolean {
  if (!("waiting" in value && types.isSet(value.waiting) && unmodifiedCollection(value.waiting, Set.prototype))) {
    return false
  }
  for (const job of value.waiting) {
    if (!job || typeof job !== "object" || !("start" in job) || typeof job.start !== "function") return false
  }
  return (
    "running" in value && nullablePromise(value.running) && "retirement" in value && nullablePromise(value.retirement)
  )
}

function nullablePromise(value: Parameters<typeof types.isPromise>[0]): boolean {
  return Object.is(value, null) || types.isPromise(value)
}

export function unmodifiedCollection(value: object, prototype: object): boolean {
  return Object.getPrototypeOf(value) === prototype && Reflect.ownKeys(value).length === 0
}
