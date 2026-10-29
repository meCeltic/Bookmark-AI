import type { Collection, NewBookmark } from "@/lib/domain/bookmark"

/**
 * What a visitor sees on /demo before they touch anything. Summaries and tags
 * were produced by the real enrichment pipeline and kept here so the AI side of
 * the app shows even on a deployment without a Gemini key.
 */

export const DEMO_COLLECTIONS: Array<Pick<Collection, "name">> = [
  { name: "Engineering" },
  { name: "Design" },
  { name: "Tools" },
  { name: "Reading list" },
]

const daysAgo = (d: number, hour = 9) => {
  const t = new Date()
  t.setDate(t.getDate() - d)
  t.setHours(hour, 12, 0, 0)
  return t.toISOString()
}

type Seed = Omit<NewBookmark, "collectionId"> & { collection?: string }

export const DEMO_BOOKMARKS: Seed[] = [
  {
    url: "https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations",
    title: "Server Actions and Mutations | Next.js",
    summary:
      "How server actions let a form or button call server code directly, with progressive enhancement, revalidation and the caveats around caching and security.",
    description: "Learn how to handle form submissions and data mutations with Next.js.",
    tags: ["nextjs", "react", "server-actions"],
    category: "documentation",
    faviconUrl: "https://nextjs.org/favicon.ico",
    imageUrl: null,
    readingMinutes: 12,
    collection: "Engineering",
    createdAt: daysAgo(1, 22),
    favourite: true,
  },
  {
    url: "https://supabase.com/docs/guides/database/postgres/row-level-security",
    title: "Row Level Security | Supabase Docs",
    summary:
      "Why every table should enable RLS, how policies use auth.uid(), and the performance habits (indexes on user_id, wrapping functions in select) that keep policies cheap.",
    tags: ["postgres", "supabase", "security"],
    category: "documentation",
    faviconUrl: "https://supabase.com/favicon/favicon-32x32.png",
    readingMinutes: 9,
    collection: "Engineering",
    createdAt: daysAgo(2),
    readAt: daysAgo(1),
  },
  {
    url: "https://www.postgresql.org/docs/current/textsearch-intro.html",
    title: "PostgreSQL: Full Text Search introduction",
    summary:
      "The official tour of tsvector and tsquery: how documents are parsed into lexemes, why plain LIKE is not search, and where ranking and indexes fit.",
    tags: ["postgres", "search"],
    category: "documentation",
    faviconUrl: "https://www.postgresql.org/favicon.ico",
    readingMinutes: 7,
    collection: "Engineering",
    createdAt: daysAgo(3, 14),
    readAt: daysAgo(2),
  },
  {
    url: "https://martinfowler.com/bliki/CQRS.html",
    title: "CQRS",
    summary:
      "Martin Fowler's short, sceptical note on separating read and write models: when the split pays off, and why most systems should not start there.",
    tags: ["architecture", "patterns"],
    category: "article",
    faviconUrl: "https://martinfowler.com/favicon.ico",
    readingMinutes: 6,
    collection: "Engineering",
    createdAt: daysAgo(4),
    favourite: true,
    readAt: daysAgo(3),
  },
  {
    url: "https://github.com/spring-projects/spring-boot",
    title: "spring-projects/spring-boot",
    summary:
      "The Spring Boot repository: opinionated Spring setup with embedded servers, auto-configuration and production-ready actuators.",
    tags: ["java", "spring", "repository"],
    category: "repository",
    faviconUrl: "https://github.com/favicon.ico",
    collection: "Engineering",
    createdAt: daysAgo(5, 19),
    readAt: daysAgo(5),
  },
  {
    url: "https://www.youtube.com/watch?v=8aGhZQkoFbQ",
    title: "What the heck is the event loop anyway? | Philip Roberts | JSConf EU",
    summary:
      "The classic JSConf talk that walks through the call stack, web APIs, the callback queue and the event loop with a live visualiser.",
    tags: ["javascript", "talk"],
    category: "video",
    faviconUrl: "https://www.youtube.com/favicon.ico",
    readingMinutes: 27,
    collection: "Engineering",
    createdAt: daysAgo(6),
    readAt: daysAgo(6),
  },
  {
    url: "https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html",
    title: "Server-Side Request Forgery Prevention Cheat Sheet",
    summary:
      "OWASP's checklist for any feature that fetches a user-supplied URL: allow-list schemes, resolve DNS and block private ranges, re-check every redirect, cap sizes.",
    tags: ["security", "ssrf"],
    category: "reference",
    faviconUrl: "https://cheatsheetseries.owasp.org/assets/images/favicon.ico",
    readingMinutes: 11,
    collection: "Engineering",
    createdAt: daysAgo(7, 11),
    favourite: true,
    readAt: daysAgo(7),
  },
  {
    url: "https://ai.google.dev/gemini-api/docs/structured-output",
    title: "Structured output | Gemini API",
    summary:
      "How to make Gemini return JSON that matches a schema you declare, so the response can be validated instead of parsed by hope.",
    tags: ["gemini", "llm", "api"],
    category: "documentation",
    faviconUrl: "https://ai.google.dev/favicon.ico",
    readingMinutes: 8,
    collection: "Engineering",
    createdAt: daysAgo(8),
  },
  {
    url: "https://rauno.me/craft/interaction-design",
    title: "Invisible Details of Interaction Design",
    summary:
      "Rauno Freiberg on the tiny timing, easing and hit-area decisions that make an interface feel considered, with live examples for each.",
    tags: ["design", "interaction", "motion"],
    category: "article",
    faviconUrl: "https://rauno.me/favicon.ico",
    readingMinutes: 14,
    collection: "Design",
    createdAt: daysAgo(2, 20),
    favourite: true,
    readAt: daysAgo(2),
  },
  {
    url: "https://www.nngroup.com/articles/ten-usability-heuristics/",
    title: "10 Usability Heuristics for User Interface Design",
    summary:
      "Jakob Nielsen's ten heuristics, from visibility of system status to help and documentation, each with a short example of what violating it looks like.",
    tags: ["design", "usability"],
    category: "reference",
    faviconUrl: "https://www.nngroup.com/favicon.ico",
    readingMinutes: 10,
    collection: "Design",
    createdAt: daysAgo(9),
    readAt: daysAgo(8),
  },
  {
    url: "https://fonts.google.com/specimen/Fraunces",
    title: "Fraunces - Google Fonts",
    summary:
      "A soft, slightly wonky display serif with optical-size and 'WONK' axes, drawn by Undercase Type; good for headings that want some warmth.",
    tags: ["typography", "fonts"],
    category: "tool",
    faviconUrl: "https://www.gstatic.com/images/branding/product/1x/google_fonts_32dp.png",
    collection: "Design",
    createdAt: daysAgo(10, 16),
    readAt: daysAgo(10),
  },
  {
    url: "https://www.refactoringui.com/",
    title: "Refactoring UI",
    summary:
      "Adam Wathan and Steve Schoger's book of practical visual-design rules for developers: hierarchy, spacing systems, colour palettes and when to break the grid.",
    tags: ["design", "book"],
    category: "product",
    faviconUrl: "https://www.refactoringui.com/favicon.ico",
    collection: "Design",
    createdAt: daysAgo(12),
  },
  {
    url: "https://excalidraw.com/",
    title: "Excalidraw",
    summary:
      "A hand-drawn-style whiteboard in the browser, end-to-end encrypted for live collaboration, with no account needed.",
    tags: ["tool", "diagrams"],
    category: "tool",
    faviconUrl: "https://excalidraw.com/favicon.ico",
    collection: "Tools",
    createdAt: daysAgo(3, 10),
    favourite: true,
    readAt: daysAgo(3),
  },
  {
    url: "https://regex101.com/",
    title: "regex101: build, test, and debug regex",
    summary:
      "An online regular-expression tester with a live explanation panel, match debugger and flavour switch for PCRE, JavaScript, Python and Go.",
    tags: ["tool", "regex"],
    category: "tool",
    faviconUrl: "https://regex101.com/favicon.ico",
    collection: "Tools",
    createdAt: daysAgo(11),
    readAt: daysAgo(11),
  },
  {
    url: "https://sqlfiddle.com/",
    title: "SQL Fiddle",
    summary:
      "Scratchpad for trying SQL against Postgres, MySQL and SQLite schemas without installing anything.",
    tags: ["tool", "sql"],
    category: "tool",
    faviconUrl: "https://sqlfiddle.com/favicon.ico",
    collection: "Tools",
    createdAt: daysAgo(14),
    readAt: daysAgo(14),
  },
  {
    url: "https://caniuse.com/",
    title: "Can I use... Support tables for HTML5, CSS3, etc",
    summary:
      "Browser support tables for web platform features, with usage share so you can judge how much of your audience a feature leaves behind.",
    tags: ["tool", "css", "browsers"],
    category: "reference",
    faviconUrl: "https://caniuse.com/img/favicon-128.png",
    collection: "Tools",
    createdAt: daysAgo(16, 8),
    readAt: daysAgo(15),
  },
  {
    url: "https://paulgraham.com/ds.html",
    title: "Do Things that Don't Scale",
    summary:
      "Paul Graham's essay arguing that early startups should recruit users by hand, delight them disproportionately and resist automating too soon.",
    tags: ["essay", "startups"],
    category: "article",
    faviconUrl: "https://paulgraham.com/favicon.ico",
    readingMinutes: 18,
    collection: "Reading list",
    createdAt: daysAgo(1, 8),
  },
  {
    url: "https://jvns.ca/blog/2024/01/18/why-is-git-so-hard/",
    title: "Git branches: intuition & reality",
    summary:
      "Julia Evans unpicks why git feels hard: branches are pointers, history is a graph, and the commands name the wrong mental model.",
    tags: ["git", "essay"],
    category: "article",
    faviconUrl: "https://jvns.ca/favicon.ico",
    readingMinutes: 9,
    collection: "Reading list",
    createdAt: daysAgo(2, 7),
  },
  {
    url: "https://www.joelonsoftware.com/2000/04/06/things-you-should-never-do-part-i/",
    title: "Things You Should Never Do, Part I",
    summary:
      "Joel Spolsky's warning against rewriting working software from scratch, told through Netscape throwing away its browser codebase.",
    tags: ["essay", "engineering"],
    category: "article",
    faviconUrl: "https://www.joelonsoftware.com/favicon.ico",
    readingMinutes: 8,
    collection: "Reading list",
    createdAt: daysAgo(5, 23),
  },
  {
    url: "https://arxiv.org/abs/1706.03762",
    title: "Attention Is All You Need",
    summary:
      "The 2017 paper that introduced the Transformer: attention-only sequence modelling, no recurrence, and the architecture behind modern language models.",
    tags: ["paper", "ml", "transformers"],
    category: "paper",
    faviconUrl: "https://arxiv.org/favicon.ico",
    readingMinutes: 45,
    collection: "Reading list",
    createdAt: daysAgo(13),
  },
  {
    url: "https://news.ycombinator.com/",
    title: "Hacker News",
    summary: "Y Combinator's link aggregator for programming, startups and the occasional argument about tabs.",
    tags: ["news"],
    category: "other",
    faviconUrl: "https://news.ycombinator.com/favicon.ico",
    createdAt: daysAgo(4, 18),
    readAt: daysAgo(4),
  },
  {
    url: "https://12factor.net/",
    title: "The Twelve-Factor App",
    summary:
      "Heroku's manifesto for services that deploy cleanly: config in the environment, stateless processes, logs as streams, dev/prod parity.",
    tags: ["architecture", "devops"],
    category: "reference",
    faviconUrl: "https://12factor.net/images/favicon.ico",
    readingMinutes: 20,
    createdAt: daysAgo(18),
    readAt: daysAgo(17),
  },
  {
    url: "https://example.com/blog/2019/this-post-was-removed",
    title: "A post that no longer exists",
    summary: "Saved from a newsletter in 2019. The link now returns a 404; the health check flags it so it can be cleaned up.",
    tags: ["archive"],
    category: "article",
    faviconUrl: null,
    createdAt: daysAgo(40),
    readAt: daysAgo(39),
    archivedAt: daysAgo(20),
  },
  {
    url: "https://www.smashingmagazine.com/2021/07/css-grid-tips-tricks/",
    title: "CSS Grid tips and tricks",
    summary: "Older grid article kept for the subgrid and masonry notes; most of it is in the spec now.",
    tags: ["css"],
    category: "article",
    faviconUrl: "https://www.smashingmagazine.com/favicon.ico",
    readingMinutes: 12,
    createdAt: daysAgo(60),
    readAt: daysAgo(58),
    archivedAt: daysAgo(30),
  },
]

/** Resolve collection names to ids and mark the seed as already enriched. */
export function buildSeed(collections: Collection[]): NewBookmark[] {
  const byName = new Map(collections.map((c) => [c.name, c.id]))
  return DEMO_BOOKMARKS.map(({ collection, ...rest }) => ({
    ...rest,
    collectionId: collection ? (byName.get(collection) ?? null) : null,
    enrichment: "done",
  }))
}
