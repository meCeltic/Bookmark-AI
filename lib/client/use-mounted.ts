import { useSyncExternalStore } from "react"

const subscribe = () => () => {}

/** true after hydration, false during SSR and the first client render. */
export const useMounted = () => useSyncExternalStore(subscribe, () => true, () => false)
