/** Shared floating surface styles (select, dropdown, popover). */
export const popupContentClassName =
  "z-50 rounded-lg border border-border bg-popover text-popover-foreground shadow-[0_12px_32px_rgba(8,8,8,0.12)]";

export const popupItemClassName =
  "relative flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-sm outline-none select-none focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50";

/** Trigger and list row heights stay in sync per size tier. */
export const controlHeightClassName = {
  default: "h-11",
  sm: "h-8",
} as const;

export type ControlSize = keyof typeof controlHeightClassName;
