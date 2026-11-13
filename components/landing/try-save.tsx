import { cn } from "@/lib/utils"

/**
 * The landing CTA: a real field that hands the link to /save. A plain GET form, so it works before hydration.
 * `onMark` is for the yellow closing band: a white field with dark ink in both themes.
 */
export function TrySave({ id = "try-url", onMark = false }: { id?: string; onMark?: boolean }) {
  return (
    <form action="/save" method="get" className="flex w-full max-w-[520px] gap-2">
      <label htmlFor={id} className="sr-only">Paste a link to try it</label>
      <input
        id={id}
        name="url"
        type="text"
        inputMode="url"
        autoComplete="off"
        spellCheck={false}
        required
        placeholder="Paste a link to try it"
        className={cn(
          "field h-11 min-w-0 flex-1 text-[15px]",
          onMark && "!bg-white !text-[#111216] placeholder:!text-[#6b6e76]",
        )}
      />
      <button type="submit" className="btn btn-primary h-11 px-5 text-[15px]">Save</button>
    </form>
  )
}
