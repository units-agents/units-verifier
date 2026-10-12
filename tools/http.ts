// Small helpers shared by the kit's own tools. Read only: every request is a GET to a public route.

/** The value after --name, or undefined. */
export const opt = (argv: string[], name: string): string | undefined => (argv.includes(`--${name}`) ? argv[argv.indexOf(`--${name}`) + 1] : undefined);

/** The Core address: --core, else UNITS_CORE. */
export function coreOf(argv: string[]): string {
  const c = (opt(argv, "core") ?? process.env.UNITS_CORE ?? "").replace(/\/+$/, "");
  if (!c) {
    console.error("no Core address: pass --core <url> (./units-verifier fills it from units.env)");
    process.exit(2);
  }
  return c;
}

/** GET a JSON route. A 429 from the site's gate is retried after the wait it names. */
export async function getJson(core: string, path: string): Promise<any> {
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(core + path, { headers: { accept: "application/json" } });
    if (r.status === 429 && attempt < 5) {
      const wait = Math.min(60, Math.max(1, Number(r.headers.get("retry-after") ?? 2)));
      await new Promise((ok) => setTimeout(ok, wait * 1000));
      continue;
    }
    if (!r.ok) throw new Error(`GET ${path}: HTTP ${r.status}`);
    return r.json();
  }
}
