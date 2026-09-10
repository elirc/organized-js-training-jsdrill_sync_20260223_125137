import { validateAll } from "./contentFiles";

/**
 * `npm run content:check` — validates the authored questions without touching
 * the database, so it's safe to run in CI.
 */
const { errors, tracks, modules, items, byType } = validateAll();

console.log(`\n${tracks} tracks · ${modules} modules · ${items} items`);
console.log(
  Object.entries(byType)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => `  ${type.padEnd(8)} ${count}`)
    .join("\n")
);

if (errors.length > 0) {
  console.error(`\n${errors.length} problem(s):`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log("\nContent looks good.\n");
