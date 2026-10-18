import { join, parse } from "node:path"

import { describe, expect, test } from "vitest"

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
  expect(isRawDevicePath(path, cwd, "win32")).toBe(true)
})

describe.skipIf(process.platform !== "win32")("volume GUID paths on Windows", () => {
  test("a volume GUID with no file under it is a raw device, with or without the trailing separator", () => {
    const guidRoot = volumeGuidForm(parse(process.cwd()).root)

    expect(isRawDevicePath(guidRoot, cwd, "win32")).toBe(true)
    expect(isRawDevicePath(guidRoot.replace(/\\$/, ""), cwd, "win32")).toBe(true)
  })

  test("a file named under a drive, UNC or volume GUID namespace path is not a raw device", () => {
    const file = join(process.cwd(), "elsewhere.txt")

    expect(isRawDevicePath(devicePathForm(file), cwd, "win32")).toBe(false)
    expect(isRawDevicePath(volumeGuidForm(file), cwd, "win32")).toBe(false)
    expect(isRawDevicePath(String.raw`\\?\UNC\server\share\file.txt`, cwd, "win32")).toBe(false)
  })
})

test("plain drive paths, relative paths and ordinary UNC paths are not raw devices", () => {
  expect(isRawDevicePath(join("C:", "Users", "x.md"), cwd, "win32")).toBe(false)
  expect(isRawDevicePath("notes/x.md", cwd, "win32")).toBe(false)
  expect(isRawDevicePath(String.raw`\\server\share\file.txt`, cwd, "win32")).toBe(false)
})

describe.each(["linux", "darwin"] as const)("raw and namespace paths on %s", (platform) => {
  test.each(["/proc/self/fd/3", "/dev/fd/0", "/proc/1234/root/etc"])("%s is always refused", (path) => {
    expect(isRawDevicePath(path, "/home/ana", platform)).toBe(true)
  })

  test("a relative path that lands under /dev/fd is refused", () => {
    expect(isRawDevicePath("fd/3", "/dev", platform)).toBe(true)
  })

  test("look-alike paths and Windows device forms are not raw devices", () => {
    expect(isRawDevicePath("/proc/self/fdx", "/home/ana", platform)).toBe(false)
    expect(isRawDevicePath(String.raw`\\.\PhysicalDrive0`, "/home/ana", platform)).toBe(false)
    expect(isRawDevicePath("notes/x.md", "/home/ana", platform)).toBe(false)
  })
})
