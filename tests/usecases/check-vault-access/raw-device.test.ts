import { join, parse } from "node:path"

import { expect, test } from "vitest"

import { isRawDevicePath } from "#src/usecases"
import { devicePathForm, volumeGuidForm } from "#test-helpers"

const cwd = join("C:", "work")

test.each([
  String.raw`\\.\C:`,
  "\\\\.\\C:\\",
  String.raw`\\.\PhysicalDrive0`,
  String.raw`\\.\GLOBALROOT\Device\HarddiskVolume3`,
  String.raw`\\.\GLOBALROOT\Device\HarddiskVolume3\Users\x.md`,
  String.raw`\\?\GLOBALROOT\Device\HarddiskVolume3`,
  "//./PhysicalDrive0",
])("%s is a raw device", (path) => {
  expect(isRawDevicePath(path, cwd)).toBe(true)
})

test("a volume GUID with no file under it is a raw device, with or without the trailing separator", () => {
  const guidRoot = volumeGuidForm(parse(process.cwd()).root)

  expect(isRawDevicePath(guidRoot, cwd)).toBe(true)
  expect(isRawDevicePath(guidRoot.replace(/\\$/, ""), cwd)).toBe(true)
})

test("a file named under a drive, UNC or volume GUID namespace path is not a raw device", () => {
  const file = join(process.cwd(), "elsewhere.txt")

  expect(isRawDevicePath(devicePathForm(file), cwd)).toBe(false)
  expect(isRawDevicePath(volumeGuidForm(file), cwd)).toBe(false)
  expect(isRawDevicePath(String.raw`\\?\UNC\server\share\file.txt`, cwd)).toBe(false)
})

test("plain drive paths, relative paths and ordinary UNC paths are not raw devices", () => {
  expect(isRawDevicePath(join("C:", "Users", "x.md"), cwd)).toBe(false)
  expect(isRawDevicePath("notes/x.md", cwd)).toBe(false)
  expect(isRawDevicePath(String.raw`\\server\share\file.txt`, cwd)).toBe(false)
})
