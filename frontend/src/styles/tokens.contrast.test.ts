/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Every text colour in the design tokens meets WCAG AA (4.5:1) on every background it is drawn on, in all three themes
 * (PRD section 17, "Accessibility: token pairs meet 4.5:1"). A new token pair goes in the list; a theme that breaks one fails here.
 */

const css = readFileSync(new URL("./tokens.css", import.meta.url), "utf8");

function theme(name: string): Record<string, string> {
  const block = new RegExp(`\\[data-theme="${name}"\\]\\s*\\{([^}]*)\\}`).exec(css);
  if (!block) throw new Error(`No ${name} theme in tokens.css`);
  const out: Record<string, string> = {};
  for (const [, key, value] of block[1]!.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)) out[key!] = value!;
  return out;
}

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const h = hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join("")}` : hex;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * channel(r!) + 0.7152 * channel(g!) + 0.0722 * channel(b!);
}

/** WCAG contrast ratio, 1 to 21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** [text colour, background it is drawn on]. */
const PAIRS: [string, string][] = [
  ["ink", "surface-0"],
  ["ink", "surface-1"],
  ["ink", "surface-2"],
  ["ink-muted", "surface-0"],
  ["ink-muted", "surface-1"],
  ["ink-muted", "surface-2"],
  ["on-chrome", "chrome"],
  ["on-chrome-muted", "chrome"],
  ["on-route", "route"],
  ["on-route", "route-hover"],
  ["route", "surface-0"],
  ["route", "surface-1"],
  ["route", "route-soft"],
  ["on-signal", "signal"],
  ["warning", "surface-1"],
  ["warning", "signal-soft"],
  ["success", "surface-1"],
  ["success", "success-soft"],
  ["danger", "surface-1"],
  ["danger", "danger-soft"],
  ["on-danger", "danger"],
  ["offline", "surface-1"],
  ["offline", "offline-soft"],
  ["chilled", "surface-1"],
  ["chilled", "chilled-soft"],
  ["brand-fresh", "surface-1"],
  ["brand-fresh", "brand-fresh-soft"],
  ["brand-style", "surface-1"],
  ["brand-style", "brand-style-soft"],
  ["brand-tech", "surface-1"],
  ["brand-tech", "brand-tech-soft"],
];

describe.each(["light", "dark", "field"])("the %s theme", (name) => {
  const colours = theme(name);

  it.each(PAIRS)("%s on %s is at least 4.5:1", (fg, bg) => {
    const [front, back] = [colours[fg], colours[bg]];
    if (!front || !back) return; // a theme that does not draw this pairing does not define it
    const ratio = contrast(front, back);
    expect(ratio, `${fg} ${front} on ${bg} ${back} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
  });

  it("defines the ink and surface a page is drawn with", () => {
    for (const key of ["ink", "surface-0", "surface-1"]) expect(colours[key], key).toBeDefined();
  });
});
