#!/usr/bin/env bun
// Prints where the code in this image came from: the monorepo commit of vendor/SOURCE.json.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const s = JSON.parse(readFileSync(join(import.meta.dir, "..", "SOURCE.json"), "utf8")) as { source_repository: string; source_commit: string; files: Record<string, string>; recipes: string[] };
console.log(`source      ${s.source_repository}`);
console.log(`commit      ${s.source_commit}`);
console.log(`files       ${Object.keys(s.files).length}`);
console.log(`recipes     ${s.recipes.length}: ${s.recipes.join(", ")}`);
