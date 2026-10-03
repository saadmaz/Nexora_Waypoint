// Fails if the production build still carries a mock, a persona name or a date written in the code (DP-26).
//
//   npm run build && npm run check:bundle
//
// Everything a judge reads must come from the database through the API. The mocks, their fixtures and the demo's cast
// are development only, and a production build must not contain any of them. A hit here means a literal or a mock was
// imported where it should not be.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const dist = process.argv[2] ?? "dist";

/** Strings that exist only in the mocks, the fixtures or the demo script. */
const FORBIDDEN = [
  // seed ids written in code
  "ORD2001",
  "OUT084",
  "VEH039",
  // the demo's cast
  "Kumari",
  "Anusha",
  "Nimal",
  "S. Fernando",
  // times and figures from the scripted day
  "05:42",
  "2,590",
  "19.4 km",
  // calendar dates written in code
  "Tue 29 Sep",
  "Mon 28 Sep",
  "2026-09-29",
  "2026-09-28",
];

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else if (/\.(js|mjs|html|css|json|webmanifest)$/.test(name) && !name.endsWith(".map")) yield path;
  }
}

const hits = [];
for (const file of files(dist)) {
  const text = readFileSync(file, "utf8");
  for (const needle of FORBIDDEN) {
    const at = text.indexOf(needle);
    if (at !== -1) hits.push({ file, needle, around: text.slice(Math.max(0, at - 40), at + needle.length + 40).replace(/\s+/g, " ") });
  }
}

if (hits.length > 0) {
  console.error(`The production build in ${dist}/ carries ${hits.length} forbidden literal(s):\n`);
  for (const hit of hits) console.error(`  ${hit.needle.padEnd(14)} ${hit.file}\n    ...${hit.around}...`);
  console.error("\nA mock, a fixture or a date written in the code reached the bundle. See DP-26 and frontend/src/devMocks.");
  process.exit(1);
}
console.log(`Bundle check passed: none of ${FORBIDDEN.length} forbidden literals are in ${dist}/.`);
