import { normalizeUrl, validateAndNormalizeUrl, getDomainFromUrl, joinUrl } from "@/lib/url-utils"

describe("URL Utilities", () => {
  describe("normalizeUrl", () => {
    it("adds https:// to URLs without protocol", () => {
      expect(normalizeUrl("example.com")).toBe("https://example.com")
    })

    it("preserves http:// protocol if present", () => {
      expect(normalizeUrl("http://example.com")).toBe("http://example.com")
    })

    it("preserves https:// protocol if present", () => {
      expect(normalizeUrl("https://example.com")).toBe("https://example.com")
    })

    it("trims whitespace from URLs", () => {
      expect(normalizeUrl("  example.com  ")).toBe("https://example.com")
    })
  })

  describe("validateAndNormalizeUrl", () => {
    it("returns a URL object for valid URLs", () => {
      const result = validateAndNormalizeUrl("example.com")
      expect(result).toBeInstanceOf(URL)
      expect(result.href).toBe("https://example.com/")
    })

    it("throws an error for empty URLs", () => {
      expect(() => validateAndNormalizeUrl("")).toThrow("URL cannot be empty")
    })

    it("throws an error for invalid URLs", () => {
      expect(() => validateAndNormalizeUrl("not a url")).toThrow("Invalid URL")
    })
  })

  describe("getDomainFromUrl", () => {
    it("extracts domain from a URL", () => {
      expect(getDomainFromUrl("https://example.com/path")).toBe("example.com")
    })

    it("extracts domain from a URL without protocol", () => {
      expect(getDomainFromUrl("example.com/path")).toBe("example.com")
    })

    it("returns the input if it cannot be parsed as a URL", () => {
      expect(getDomainFromUrl("not a url")).toBe("not a url")
    })
  })

  describe("joinUrl", () => {
    it("joins a base URL with a relative path", () => {
      expect(joinUrl("https://example.com", "path")).toBe("https://example.com/path")
    })

    it("handles root-relative paths", () => {
      expect(joinUrl("https://example.com/page", "/path")).toBe("https://example.com/path")
    })

    it("handles protocol-relative URLs", () => {
      expect(joinUrl("https://example.com", "//cdn.example.com/path")).toBe("https://cdn.example.com/path")
    })

    it("returns null for invalid inputs", () => {
      expect(joinUrl("invalid", "path")).toBeNull()
    })
  })
})
