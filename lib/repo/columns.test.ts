import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { BOOKMARK_COLUMNS, COLLECTION_COLUMNS } from "./supabase"

/**
 * The repository selects explicit column lists. This keeps them honest against
 * the migration, so a renamed column or a list pasted onto the wrong table
 * fails here instead of on the production backend.
 */
function columnsOf(table: string): string[] {
  const sql = readFileSync("supabase/migrations/0001_init.sql", "utf8")
  const start = sql.indexOf(`create table public.${table} (`)
  const body = sql.slice(start, sql.indexOf("\n);", start))
  return body
    .split("\n")
    .slice(1)
    .map((line) => line.trim())
    .filter((line) => /^[a-z_]+\s/.test(line) && !/^(unique|check|primary|constraint)/.test(line))
    .map((line) => line.split(/\s+/)[0]!)
}

describe("repository column lists", () => {
  it("bookmarks: every selected column exists, and only the generated vector is skipped", () => {
    const actual = columnsOf("bookmarks")
    const selected = BOOKMARK_COLUMNS.split(",")
    expect(actual).toEqual(expect.arrayContaining(selected))
    expect(actual.filter((c) => !selected.includes(c))).toEqual(["search"])
  })

  it("collections: the list matches the table exactly", () => {
    expect(COLLECTION_COLUMNS.split(",").sort()).toEqual(columnsOf("collections").sort())
  })
})
