/** The hero CTA: a real field that hands the link to /save. A plain GET form, so it works before hydration. */
export function TrySave() {
  return (
    <form action="/save" method="get" className="flex w-full max-w-[520px] gap-2">
      <label htmlFor="try-url" className="sr-only">Paste a link to try it</label>
      <input
        id="try-url"
        name="url"
        type="text"
        inputMode="url"
        autoComplete="off"
        spellCheck={false}
        required
        placeholder="Paste a link to try it"
        className="field h-11 min-w-0 flex-1 text-[15px]"
      />
      <button type="submit" className="btn btn-primary h-11 px-5 text-[15px]">Save</button>
    </form>
  )
}
