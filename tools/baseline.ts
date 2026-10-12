#!/usr/bin/env bun
// Measures the baseline of one recipe on this machine and compares it with a published
// calibration: the same comparison a qualification makes, done by hand, with no account and nothing
// sent anywhere. It builds the repository at the recipe's commit in the sandbox, runs the tests
// and measures every deterministic metric with the calibration's own seed.
//
//   baseline <recipe name> --calibration <calibration.json> [--runs 1]
//   baseline <recipe name> --core <url> [--runs 1]        the calibration of that network's unit
//
// A calibration file comes from the recipes repository (recipes/<name>/calibration.json). With
// --core, the unit whose recipe id equals this kit's recipe is used; if the network has no such
// unit (its recipe pins another image or architecture), this says so and stops.
// Exit 0 when the baseline matches, 1 when it differs, 2 when it could not be compared.
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { relDiff, type Calibration } from "@units/protocol";
import { calibrate, loadRecipe, prepareDeps } from "@units/sandbox";
import { getJson, opt } from "./http.ts";

const argv = process.argv.slice(2);
const name = argv.find((a, i) => !a.startsWith("--") && !["--calibration", "--core", "--runs"].includes(argv[i - 1] ?? ""));
if (!name) {
  console.error("usage: baseline <recipe name> (--calibration <file> | --core <url>) [--runs 1]");
  process.exit(2);
}
const dir = existsSync(join(name, "recipe.yml")) ? resolve(name) : join(import.meta.dir, "..", "recipes", name);
if (!existsSync(join(dir, "recipe.yml"))) {
  console.error(`no recipe ${name} in this kit (run "source" to list them)`);
  process.exit(2);
}
const loaded = loadRecipe(dir);
console.log(`recipe ${loaded.recipe.name} ${loaded.recipe_id}`);
console.log(`  ${loaded.recipe.repo} at ${loaded.recipe.commit.slice(0, 12)}, class ${loaded.recipe.class}, requires ${loaded.recipe.requires.arch}`);

let published: Calibration & { seed?: string };
const file = opt(argv, "calibration");
if (file) {
  const j = JSON.parse(readFileSync(file, "utf8"));
  // calibration-amd64.json wraps the calibration Core recorded
  published = j.calibration ? { ...j.calibration, recipe_id: j.recipe_id } : j;
} else {
  const core = (opt(argv, "core") ?? process.env.UNITS_CORE ?? "").replace(/\/+$/, "");
  if (!core) {
    console.error("pass --calibration <file> or --core <url>");
    process.exit(2);
  }
  const unit = ((await getJson(core, "/v1/lineages")) as any[]).find((u) => u.recipe_id === loaded.recipe_id && u.status === "active");
  if (!unit) {
    console.error(`${core} has no active unit with this recipe id. Its units of the same name pin another image or architecture, so this kit's recipe cannot be compared with them.`);
    process.exit(2);
  }
  published = (await getJson(core, `/v1/lineages/${unit.lineage_id}`)).calibration;
}
if (published.recipe_id !== loaded.recipe_id) {
  console.error(`that calibration is for recipe ${published.recipe_id.slice(0, 12)}, this kit's recipe is ${loaded.recipe_id.slice(0, 12)}: a different image, architecture or harness. Nothing to compare.`);
  process.exit(2);
}
if (!published.seed) {
  console.error("that calibration records no seed, so its base values cannot be reproduced exactly");
  process.exit(2);
}

const runs = Math.max(1, Number(opt(argv, "runs") ?? 1));
const t0 = Date.now();
const deps = await prepareDeps(loaded);
console.log(`dependency layer ${deps.digest.slice(0, 12)} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
const t1 = Date.now();
const { calibration: mine } = await calibrate({ loaded, deps, seed: published.seed, runs });
console.log(`measured in ${((Date.now() - t1) / 1000).toFixed(1)} s (${runs} test run${runs > 1 ? "s" : ""})`);

let diffs = 0;
const row = (field: string, ok: boolean, detail: string) => {
  if (!ok) diffs++;
  console.log(`${ok ? "same" : "DIFF"}  ${field.padEnd(24)} ${detail}`);
};
// with one run a flaky test cannot be told from a stable one, so compare what passed against stable plus quarantined
const passed = new Set(mine.stable);
const missing = published.stable.filter((t) => !passed.has(t));
const extra = mine.stable.filter((t) => !published.stable.includes(t) && !published.quarantined.includes(t));
row("stable tests", missing.length === 0 && extra.length === 0, `${mine.stable.length} passing here, ${published.stable.length} in the calibration${missing.length ? `, missing: ${missing.slice(0, 5).join(", ")}` : ""}${extra.length ? `, extra: ${extra.slice(0, 5).join(", ")}` : ""}`);
const notFailing = published.known_failures.filter((t) => !mine.known_failures.includes(t));
const newFailing = mine.known_failures.filter((t) => !published.known_failures.includes(t) && !published.quarantined.includes(t));
row("known failures", notFailing.length === 0 && newFailing.length === 0, `${mine.known_failures.length} failing here, ${published.known_failures.length} in the calibration${newFailing.length ? `, failing only here: ${newFailing.slice(0, 5).join(", ")}` : ""}`);
for (const m of loaded.recipe.metrics.filter((x) => x.deterministic)) {
  const a = mine.metrics[m.name];
  const b = published.metrics[m.name];
  if (!b?.enabled || b.base_value === undefined) continue;
  if (!a?.enabled || a.base_value === undefined) {
    row(`metric ${m.name}`, false, `not measured here${a?.reason ? ` (${a.reason})` : ""}, calibration ${b.base_value}`);
    continue;
  }
  const tol = m.tolerance ?? 0.001;
  row(`metric ${m.name}`, relDiff(a.base_value, b.base_value) <= tol, `${a.base_value} here, ${b.base_value} in the calibration (tolerance ${tol})`);
}
console.log(diffs === 0 ? "\nBASELINE MATCHES: this machine reproduces the published calibration" : `\n${diffs} field(s) differ from the published calibration`);
process.exit(diffs ? 1 : 0);
