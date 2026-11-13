// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, waitFor } from "@testing-library/react"
import { Favicon } from "../favicon"
import { metaHost, slotHost } from "../dashboard/index-card"

vi.mock("@/lib/client/blank-icon", () => ({
  PROBE_MAX_PX: 32,
  isBlankIcon: (src: string) => Promise.resolve(src.includes("blank")),
}))

const load = (img: HTMLImageElement, width: number) => {
  Object.defineProperty(img, "naturalWidth", { value: width, configurable: true })
  fireEvent.load(img)
}

describe("Favicon", () => {
  it("shows the lettered tile when there is no icon URL", () => {
    const { container } = render(<Favicon url="https://www.joelonsoftware.com/x" src={null} />)
    expect(container.querySelector("[data-favicon-tile]")).toHaveTextContent("J")
    expect(container.querySelector("img")).toBeNull()
  })

  it("keeps the tile under the icon until it loads, and falls back to it when it fails", () => {
    const { container } = render(<Favicon url="https://ai.google.dev/" src="https://ai.google.dev/favicon.ico" />)
    expect(container.querySelector("[data-favicon-tile]")).toHaveTextContent("G")
    fireEvent.error(container.querySelector("img")!)
    expect(container.querySelector("img")).toBeNull()
    expect(container.querySelector("[data-favicon-tile]")).toHaveTextContent("G")
  })

  it("takes the letter from the registrable domain shown beside it", () => {
    const { container } = render(<Favicon url="https://cheatsheetseries.owasp.org/x" src={null} />)
    expect(container.querySelector("[data-favicon-tile]")).toHaveTextContent("O")
  })
})

describe("Favicon blank icons", () => {
  it("shows a real icon once it loads, fading the tile out", async () => {
    const { container } = render(<Favicon url="https://jvns.ca/" src="https://jvns.ca/favicon.ico" />)
    load(container.querySelector("img")!, 16)
    await waitFor(() => expect(container.querySelector("img")).toHaveClass("opacity-100"))
    expect(container.querySelector("[data-favicon-tile]")).toHaveClass("opacity-0")
  })

  it("swaps an icon that loads with no visible pixels for the tile", async () => {
    const { container } = render(<Favicon url="https://www.joelonsoftware.com/" src="https://www.joelonsoftware.com/blank.ico" />)
    load(container.querySelector("img")!, 16)
    await waitFor(() => expect(container.querySelector("[data-favicon-tile]")).toHaveTextContent("J"))
    expect(container.querySelector("img")).toBeNull()
  })
})

describe("slotHost", () => {
  it("keeps hosts that fit and drops only the subdomain part of long ones", () => {
    expect(slotHost("joelonsoftware.com")).toBe("joelonsoftware.com")
    expect(slotHost("cheatsheetseries.owasp.org")).toBe("owasp.org")
    expect(slotHost("averyveryverylongname.co.uk")).toBe("averyveryverylongname.co.uk")
    expect(slotHost("someverylongsubdomain.bbc.co.uk")).toBe("bbc.co.uk")
  })
})

describe("metaHost", () => {
  it("drops the subdomain, then the suffix, so domain · age never truncates next to the age", () => {
    expect(metaHost("joelonsoftware.com", "14 Sep")).toBe("joelonsoftware.com")
    expect(metaHost("smashingmagazine.com", "14 Sep")).toBe("smashingmagazine")
    expect(metaHost("cheatsheetseries.owasp.org", "3 Nov")).toBe("owasp.org")
  })
})
