/** Field focus border — var(--field-focus) / #8f959e, no outline ring. */
export const fieldFocusClassName =
  "focus-visible:border-field-focus focus-visible:outline-none focus-visible:ring-0";

/** For composite field shells (e.g. time input) that delegate focus to children. */
export const fieldFocusWithinClassName =
  "focus-within:border-field-focus focus-within:outline-none focus-within:ring-0";

/** Shared class strings for places that still use native inputs. Prefer <Input /> / <Textarea />. */
export const inputClassName =
  `h-11 w-full min-w-0 rounded-[var(--radius)] border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground ${fieldFocusClassName} disabled:cursor-not-allowed disabled:opacity-50`;

export const textareaClassName =
  `min-h-20 w-full rounded-[var(--radius)] border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground ${fieldFocusClassName} disabled:cursor-not-allowed disabled:opacity-50`;
