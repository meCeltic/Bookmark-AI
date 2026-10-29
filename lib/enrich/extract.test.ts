import { describe, expect, it } from "vitest"
import { decodeEntities, extractPage, TEXT_MAX, TITLE_MAX } from "./extract"

const BASE = "https://blog.example.com/posts/2026/hello-world"

function paragraphs(count: number, wordsEach: number): string {
  const words = Array.from({ length: wordsEach }, (_, i) => `word${i}`).join(" ")
  return Array.from({ length: count }, () => `<p>${words}</p>`).join("\n")
}

const BLOG_PAGE = `<!DOCTYPE html>
<html lang="en-GB">
<head>
  <meta charset="utf-8">
  <title>Hello World &mdash; Example Blog</title>
  <meta property="og:title" content="Hello, World: a first post" />
  <meta name="twitter:title" content="Twitter title should lose">
  <meta name="description" content="A short description of the post &amp; its aims.">
  <meta property="og:description" content="OG description should lose">
  <meta property="og:image" content="/images/hero.jpg">
  <link rel="stylesheet" href="/style.css">
  <link rel="shortcut icon" href="../../favicon-32.png">
  <link rel="apple-touch-icon" href="/apple.png">
  <script>window.dataLayer = [{ title: "not the title" }]</script>
  <style>.hero { display: none }</style>
</head>
<body>
  <!-- a comment with words that must not count -->
  <header><h1>Site header text</h1><nav><a href="/">Home</a><a href="/about">About</a></nav></header>
  <aside>Sidebar junk with many many words</aside>
  <main>
    <article>
      <h1>Hello, World</h1>
      <p>First   paragraph with <strong>bold</strong> text, an &quot;entity&quot; and India&#039;s apostrophe.</p>
      <p>Second paragraph.<br>With a line break.</p>
      <ul><li>One</li><li>Two</li></ul>
      <script type="application/ld+json">{"@type":"Article"}</script>
      <noscript>Enable JavaScript</noscript>
      <svg><text>vector text</text></svg>
      <form><input name="q"><button>Search</button></form>
      ${paragraphs(10, 60)}
    </article>
  </main>
  <footer>Copyright &copy; 2026 Footer words</footer>
</body>
</html>`

describe("extractPage on a realistic blog page", () => {
  const page = extractPage(BLOG_PAGE, BASE)

  it("prefers og:title over twitter:title and <title>", () => {
    expect(page.title).toBe("Hello, World: a first post")
  })

  it("prefers meta description over og:description", () => {
    expect(page.description).toBe("A short description of the post & its aims.")
  })

  it("resolves a relative favicon href against the page URL", () => {
    expect(page.faviconUrl).toBe("https://blog.example.com/favicon-32.png")
  })

  it("resolves a root-relative og:image", () => {
    expect(page.imageUrl).toBe("https://blog.example.com/images/hero.jpg")
  })

  it("reads the html lang attribute", () => {
    expect(page.lang).toBe("en-GB")
  })

  it("keeps the article prose with entities decoded and whitespace collapsed", () => {
    expect(page.text).toContain('First paragraph with bold text, an "entity" and India\'s apostrophe.')
    expect(page.text).toContain("Second paragraph.\nWith a line break.")
    expect(page.text).toContain("One\nTwo")
  })

  it("drops scripts, styles, noscript, svg, forms, comments and page chrome", () => {
    for (const noise of [
      "dataLayer",
      "display: none",
      "@type",
      "Enable JavaScript",
      "vector text",
      "Search",
      "must not count",
      "Site header",
      "Home",
      "Sidebar junk",
      "Footer words",
    ]) {
      expect(page.text).not.toContain(noise)
    }
  })

  it("computes reading time from the word count at 220 wpm", () => {
    // 10 x 60 generated words plus the hand-written sentences, well over 600.
    expect(page.readingMinutes).toBe(3)
  })
})

describe("extractPage fallbacks", () => {
  it("falls back to <title>, origin favicon and null description", () => {
    const page = extractPage("<html><head><title>  Only   a Title </title></head><body><p>hi</p></body></html>", BASE)
    expect(page.title).toBe("Only a Title")
    expect(page.description).toBeNull()
    expect(page.faviconUrl).toBe("https://blog.example.com/favicon.ico")
    expect(page.imageUrl).toBeNull()
    expect(page.lang).toBeNull()
    expect(page.readingMinutes).toBeNull()
    expect(page.text).toBe("hi")
  })

  it("falls back to the hostname when there is no title at all", () => {
    expect(extractPage("<p>nothing</p>", BASE).title).toBe("blog.example.com")
  })

  it("uses twitter:title when og:title is absent and the title tag is empty", () => {
    const html = '<title> </title><meta name="twitter:title" content="From Twitter">'
    expect(extractPage(html, BASE).title).toBe("From Twitter")
  })

  it("uses og:description and twitter:description in that order", () => {
    const html = '<meta property="og:description" content="OG"><meta name="twitter:description" content="TW">'
    expect(extractPage(html, BASE).description).toBe("OG")
    expect(extractPage('<meta name="twitter:description" content="TW">', BASE).description).toBe("TW")
  })

  it("ignores meta tags with empty content", () => {
    const html = '<meta property="og:title" content="   "><title>Real</title>'
    expect(extractPage(html, BASE).title).toBe("Real")
  })

  it("matches meta attribute names case-insensitively and in any order", () => {
    const html = "<META CONTENT='Shouty' PROPERTY='OG:TITLE'>"
    expect(extractPage(html, BASE).title).toBe("Shouty")
  })

  it("caps the title at 300 characters", () => {
    const html = `<title>${"t".repeat(400)}</title>`
    expect(extractPage(html, BASE).title).toHaveLength(TITLE_MAX)
  })

  it("returns an empty title and null favicon when the base URL is invalid", () => {
    const page = extractPage("<p>x</p>", "not a url")
    expect(page.title).toBe("")
    expect(page.faviconUrl).toBeNull()
  })
})

describe("favicon and image resolution", () => {
  const cases: ReadonlyArray<[href: string, expected: string]> = [
    ["//cdn.example.net/fav.ico", "https://cdn.example.net/fav.ico"],
    ["/static/fav.ico", "https://blog.example.com/static/fav.ico"],
    ["fav.ico", "https://blog.example.com/posts/2026/fav.ico"],
    ["../fav.ico", "https://blog.example.com/posts/fav.ico"],
    ["https://other.example.org/fav.png", "https://other.example.org/fav.png"],
  ]

  it.each(cases)("resolves rel=icon href %j", (href, expected) => {
    expect(extractPage(`<link rel="icon" href="${href}">`, BASE).faviconUrl).toBe(expected)
  })

  it("prefers rel=icon over apple-touch-icon regardless of document order", () => {
    const html = '<link rel="apple-touch-icon" href="/apple.png"><link rel="icon" href="/icon.png">'
    expect(extractPage(html, BASE).faviconUrl).toBe("https://blog.example.com/icon.png")
  })

  it("uses apple-touch-icon when no icon link exists", () => {
    expect(extractPage('<link rel="apple-touch-icon" href="/apple.png">', BASE).faviconUrl).toBe(
      "https://blog.example.com/apple.png",
    )
  })

  it("falls back to /favicon.ico when the icon href is not http(s)", () => {
    const html = '<link rel="icon" href="data:image/png;base64,AAAA">'
    expect(extractPage(html, BASE).faviconUrl).toBe("https://blog.example.com/favicon.ico")
  })

  it("drops non-http images", () => {
    expect(extractPage('<meta property="og:image" content="data:image/png;base64,AAAA">', BASE).imageUrl).toBeNull()
  })

  it("falls back to twitter:image", () => {
    const html = '<meta name="twitter:image" content="https://img.example.com/t.jpg">'
    expect(extractPage(html, BASE).imageUrl).toBe("https://img.example.com/t.jpg")
  })
})

describe("entity decoding", () => {
  const cases: ReadonlyArray<[input: string, expected: string]> = [
    ["Trainings &amp; Placement", "Trainings & Placement"],
    ["India&#039;s", "India's"],
    ["It&#x27;s &#x41;", "It's A"],
    ["&lt;b&gt; &quot;q&quot; &apos;a&apos;", "<b> \"q\" 'a'"],
    ["a&nbsp;b &mdash; c &ndash; d&hellip; &copy;", "a b — c – d… ©"],
    ["&AMP; &Lt;", "& <"],
    ["&unknown; &#xFFFFFFF; &#0;", "&unknown; &#xFFFFFFF; &#0;"],
    ["&#128512;", "\u{1F600}"],
  ]

  it.each(cases)("decodeEntities(%j) -> %j", (input, expected) => {
    expect(decodeEntities(input)).toBe(expected)
  })

  it("decodes entities in titles after tag stripping, never the other way round", () => {
    const html = "<title>Trainings &amp; Placement</title><body><p>&lt;script&gt;alert(1)&lt;/script&gt;</p></body>"
    const page = extractPage(html, BASE)
    expect(page.title).toBe("Trainings & Placement")
    expect(page.text).toBe("<script>alert(1)</script>")
  })
})

describe("main content selection", () => {
  it("prefers <article> over the rest of the body", () => {
    const html = "<body><div>Outer noise</div><article><p>Article text</p></article><div>More noise</div></body>"
    expect(extractPage(html, BASE).text).toBe("Article text")
  })

  it("prefers <main> when there is no article", () => {
    const html = "<body><div>Outer noise</div><main><p>Main text</p></main></body>"
    expect(extractPage(html, BASE).text).toBe("Main text")
  })

  it("uses the whole body otherwise and converts block tags to newlines", () => {
    const html = "<body><h1>Heading</h1><div>Para<span> inline</span></div><table><tr><td>a</td><td>b</td></tr></table></body>"
    expect(extractPage(html, BASE).text).toBe("Heading\nPara inline\na\nb")
  })

  it("strips nav/header/footer/aside/form even without article or main", () => {
    const html = "<body><nav>Nav</nav><p>Keep</p><footer>Foot</footer><form>Form</form></body>"
    expect(extractPage(html, BASE).text).toBe("Keep")
  })

  it("is not fooled by uppercase tags or attributes on closing tags", () => {
    const html = "<BODY><SCRIPT>bad()</SCRIPT><P>Good</P ></BODY>"
    expect(extractPage(html, BASE).text).toBe("Good")
  })
})

describe("reading time and text cap", () => {
  it("returns null reading time under 30 words", () => {
    expect(extractPage(`<body>${paragraphs(1, 29)}</body>`, BASE).readingMinutes).toBeNull()
  })

  it("rounds reading time up", () => {
    expect(extractPage(`<body>${paragraphs(1, 30)}</body>`, BASE).readingMinutes).toBe(1)
    expect(extractPage(`<body>${paragraphs(1, 221)}</body>`, BASE).readingMinutes).toBe(2)
  })

  it("caps text at 8000 characters on a word boundary but counts the full text for reading time", () => {
    const page = extractPage(`<body>${paragraphs(100, 50)}</body>`, BASE)
    expect(page.text.length).toBeLessThanOrEqual(TEXT_MAX)
    expect(page.text.length).toBeGreaterThan(TEXT_MAX - 20)
    expect(page.text).not.toMatch(/\s$/)
    expect(page.text.split(/\s+/).at(-1)).toMatch(/^word\d+$/)
    expect(page.readingMinutes).toBe(Math.ceil(5000 / 220))
  })
})
