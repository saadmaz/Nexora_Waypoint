/** A design token name, such as "route" or "ink-muted", to the CSS custom property it refers to. */
export function tokenColor(token: string): string {
  return `var(--${token})`;
}
