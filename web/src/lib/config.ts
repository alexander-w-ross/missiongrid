/**
 * Runtime configuration sourced from NEXT_PUBLIC_* env vars.
 *
 * These are inlined at build time by Next.js, so they must be referenced
 * statically (no dynamic key access) to be picked up.
 */

export const config = {
  apiUrl: (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, ""),
  wsUrl: (process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000").replace(/\/$/, ""),
  /** When true the UI runs entirely against the in-browser mock backend. */
  mock: process.env.NEXT_PUBLIC_MOCK === "1",
} as const;

/** Grid presentation constants (purely visual — the backend owns the truth). */
export const GRID = {
  /** Cells of empty space drawn around the playable grid so mission control
   *  (which may sit at e.g. x = -2) and off-grid markers remain visible. */
  gutter: 3,
} as const;
