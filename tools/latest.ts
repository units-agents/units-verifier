#!/usr/bin/env bun
// Lists the newest accepted generations of a network, so you have ids to verify.
//
//   latest --core <url> [--n 5] [--json]
//
// For each: the generation id (for verify-generation), the candidate's commit id (for verify
// --candidate and replay --candidate), its unit, target and where its GitHub commit stands.
import { coreOf, getJson, opt } from "./http.ts";

const argv = process.argv.slice(2);
const core = coreOf(argv);
const n = Math.max(1, Math.min(50, Number(opt(argv, "n") ?? 5)));

const units = new Map<string, string>();
for (const u of (await getJson(core, "/v1/lineages")) as any[]) units.set(u.lineage_id, u.recipe_name ?? u.lineage_id.slice(0, 12));
const accepted = ((await getJson(core, "/v1/candidates?status=accepted&limit=200")) as any[])
  .filter((c) => c.gen_id)
  .sort((a, b) => (b.finalized_at ?? 0) - (a.finalized_at ?? 0))
  .slice(0, n);
if (!accepted.length) {
  console.log(`no accepted generation on ${core} yet`);
  process.exit(0);
}
const out: Record<string, unknown>[] = [];
for (const c of accepted) {
  const g = await getJson(core, `/v1/generations/${c.gen_id}`);
  const gh = g.github ?? null;
  out.push({
    generation: c.gen_id,
    candidate: c.commit_id,
    unit: units.get(c.lineage_id) ?? c.lineage_id,
    height: g.height,
    kind: c.kind,
    target: c.target,
    accepted_at: new Date(g.accepted_at).toISOString(),
    github: gh?.url ?? (gh?.status ? `no commit (${gh.status})` : "no commit recorded"),
  });
}
if (argv.includes("--json")) console.log(JSON.stringify(out, null, 2));
else
  for (const o of out) {
    console.log(`generation ${o.generation}`);
    console.log(`  candidate ${o.candidate}`);
    console.log(`  unit ${o.unit}, height ${o.height}, ${o.kind} on ${Array.isArray(o.target) ? o.target.join(", ") : o.target}, accepted ${o.accepted_at}`);
    console.log(`  github ${o.github}`);
  }
