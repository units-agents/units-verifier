#!/usr/bin/env bun
// Prints the live parameters a verifier cares about, read from GET /v1/config of a Core.
// Nothing here is a constant of the kit: every figure is what the network answers now.
//
//   params --core <url> [--json]
import { coreOf, getJson } from "./http.ts";

const argv = process.argv.slice(2);
const core = coreOf(argv);
const cfg = (await getJson(core, "/v1/config")).network as Record<string, any>;
const stats = (await getJson(core, "/v1/stats")) as Record<string, any>;

const decimals = Number(cfg.token_decimals ?? 0);
/** A base-unit amount as a decimal number of tokens, exact (no floating point). */
function tokens(base: unknown): string {
  const s = String(base ?? "");
  if (!/^\d+$/.test(s)) return "not published";
  const pad = s.padStart(decimals + 1, "0");
  const whole = pad.slice(0, pad.length - decimals);
  const frac = decimals ? pad.slice(-decimals).replace(/0+$/, "") : "";
  return `${whole}${frac ? "." + frac : ""} UNITS (${s} base units)`;
}
const pct = (bps: unknown) => (typeof bps === "number" ? `${bps / 100}% of bond` : "not published");
const share = (x: unknown) => (typeof x === "number" ? `${Math.round(x * 10000) / 100}%` : "not published");
const secs = (x: unknown) => (typeof x === "number" ? `${x} s` : "not published");

const rows: [string, string][] = [
  ["Core", core],
  ["Chain mode", String(stats.chain?.mode ?? "not published")],
  ["Units", String(stats.lineages ?? "not published")],
  ["Accepted generations", String(stats.generations ?? "not published")],
  ["Registration burn", tokens(cfg.register_burn)],
  ["Minimum bond", tokens(cfg.min_bond)],
  ["Bond counted in the draw, at most", tokens(cfg.bond_cap)],
  ["Replays per candidate (quorum)", String(cfg.quorum ?? "not published")],
  ["Work units per replay", String(cfg.u_replay ?? "not published")],
  ["Rebate per cost class", tokens(cfg.rebate_per_class)],
  ["Share of assignments that are canaries", share(cfg.canary_rate)],
  ["Share of accepted generations audited", share(cfg.audit_rate)],
  ["Slash: accepting a canary", pct(cfg.canary_slash_bps)],
  ["Slash: minority on a deterministic number", pct(cfg.minority_slash_bps)],
  ["Slash: reveal does not match commitment", pct(cfg.reveal_slash_bps)],
  ["Strikes in one epoch before suspension", String(cfg.strike_limit ?? "not published")],
  ["Unbond cooldown", secs(cfg.unbond_cooldown_s)],
  ["Wait before a failed qualification is retried", secs(cfg.qualify_retry_s)],
  ["Epoch length", secs(cfg.epoch_length_s)],
];
if (argv.includes("--json")) console.log(JSON.stringify(Object.fromEntries(rows), null, 2));
else for (const [k, v] of rows) console.log(`${k.padEnd(46)} ${v}`);
