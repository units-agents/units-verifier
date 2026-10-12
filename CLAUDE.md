# units-verifier

The verifier kit of units: one Docker image, one wrapper script, one config file. What it does and how to use it: `README.md`.

## Rules
- `vendor/` is written by `bun scripts/public/export-verifier.ts` in the units monorepo; never edit it by hand. `vendor/bun.lock` is the kit's: after an export that changed a `package.json`, run `bun install` in `vendor/` and commit the lock with it.
- The kit's own files are `Dockerfile`, `entry.sh`, `compose.yaml`, `units-verifier`, `units.env`, `tools/` and the README.
- The README states only what was run and seen. Its "What works today" section is rewritten when the networks change, never softened.
- No canaries, no calibration answer keys beyond what a network already publishes, no fixture recipes.
- No em dashes anywhere. Plain language. Never invent a number: figures come from the files here, from a command the reader can run, or are left out.
- No secrets, keys, keyed RPC addresses or personal data. `keys/` is ignored by git. This repository is meant to be public.
- Docker: only touch containers and images this kit made. Never prune. Stop the worker with `./units-verifier stop`, never by pattern.
- No git remote and no push until the owner says so. No LICENSE file until the owner picks one.
- Commit your own work before going idle.

## Who is working on what
| Who | Paths | Status | Started |
|---|---|---|---|
| public repos prep lane | everything (first version) | DONE (2026-10-12: image builds from a clean clone; doctor, params, latest, verify, verify-generation against the devnet site; baseline in a real sandbox; local only, not pushed) | 2026-10-12 |
