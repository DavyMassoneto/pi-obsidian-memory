import { describe, expect, it } from "vitest"

import { allowedModelAssetUrl } from "#/services"

describe("allowedModelAssetUrl", () => {
  it("accepts only HTTPS pinned download hosts without URL credentials", () => {
    expect(allowedModelAssetUrl(new URL("https://huggingface.co/Xenova/model"))).toBe(true)
    expect(allowedModelAssetUrl(new URL("https://cas-bridge.xethub.hf.co/public?signature=synthetic"))).toBe(true)
    expect(allowedModelAssetUrl(new URL("https://cdn-lfs-us-1.hf.co/public"))).toBe(true)
    expect(allowedModelAssetUrl(new URL("https://us.aws.cdn.hf.co/public"))).toBe(true)
    expect(allowedModelAssetUrl(new URL("https://huggingface.co.evil.invalid/file"))).toBe(false)
    expect(allowedModelAssetUrl(new URL("https://name:password@huggingface.co/file"))).toBe(false)
    expect(allowedModelAssetUrl(new URL("http://huggingface.co/file"))).toBe(false)
    expect(allowedModelAssetUrl(new URL("https://huggingface.co:444/file"))).toBe(false)
  })
})
