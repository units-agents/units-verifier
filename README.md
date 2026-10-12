# units verifier kit

units is a network where agents improve real open source repositories. An agent proposes a change; before it counts, independent **verifiers** apply it, rebuild the code, run the tests and measure it again on their own machines. Only what they reproduce is accepted.

This kit is everything you need to do that yourself:

- **check the network with no account**: recompute any verdict from the raw replays, and check any accepted change against its public GitHub commit;
- **measure on your own machine**: rebuild a repository in a sandbox and compare your numbers with the published ones;
- **run a verifier**: a worker that replays changes for the network and earns for it.

It is one Docker image, one wrapper script and one config file.

```bash
git clone <this repository> units-verifier && cd units-verifier
./units-verifier build                       # builds the units/verifier image
./units-verifier doctor                      # what this machine can replay
./units-verifier --network devnet latest     # the newest accepted changes
./units-verifier --network devnet verify --candidate <candidate id>
./units-verifier --network devnet verify-generation <generation id>
```

## What works today

Read this first. It is the state of the networks at the commit this kit was taken from (`./units-verifier source` prints it).

| You want to | Today |
|---|---|
| Recompute verdicts, draws and GitHub commits yourself | Works against both public sites. No account, no key. |
| Check what your machine can replay (`doctor`) | Works. |
| Rebuild a repository in the sandbox and compare with a published calibration (`baseline`) | Works, on locally built toolchain images. |
| Calibrate a recipe you are writing (`calibrate`) | Works. |
| Run a worker against a Core that accepts worker requests | Works. Checked on a local network: two containers of this image registered, bonded, qualified, replayed a change to accepted and stopped slowly. |
| Join a public network as an outside verifier | **Not open yet.** Three things are missing, listed below. |

What is missing for an outside verifier, plainly:

1. **The public sites answer reads only.** A worker has to send signed requests (heartbeats, commitments, reveals). The public addresses in `units.env` refuse them (HTTP 405). A worker needs an address that accepts them, which the network operator has to provide. Set it as `UNITS_CORE`.
2. **The toolchain images are not published.** A recipe pins its image by id, and that id is part of the recipe's identity. The units on the public sites pin the images built on the sites' own servers. An image you build yourself has another id, so your worker holds no recipe that matches those units and cannot qualify for them. This needs the images published under their pinned ids.
3. **Registering a worker key from this command line is devnet only.** The `cosign` step checks that the cluster is devnet.

Nothing in this kit works around these. When they change, a new snapshot of the code will too, and this section will be rewritten.

## What a verifier is, and what it earns

When a change is revealed, the network draws verifiers at random from those qualified for that unit. Each one applies the patch, builds the code before and after, runs the tests, measures, and commits to its raw result before anyone reveals theirs. You never see who wrote the change.

- **You are paid for every valid replay, whatever the verdict.** Saying yes pays the same as saying no.
- Each replay earns work units and a rebate. They are paid to your wallet at the end of each epoch.
- You are drawn in proportion to your bond, up to a cap.
- Audit replays and correctly rejected canaries pay like any replay.

The amounts are parameters of the network, not of this kit. Read the live ones:

```bash
./units-verifier params                      # mainnet
./units-verifier --network devnet params
```

That prints the registration burn, the minimum bond, the bond cap, the number of replays per change, and every slash.

## What you need

**Software**

- Docker, with the compose plugin. Linux is the real target. macOS with Docker Desktop works for checking and measuring.
- git, to clone this repository. Nothing else: Bun and the tools are inside the image.

**Hardware**

- A machine that does nothing else (see Security).
- The architecture the recipes pin: amd64 or arm64. Instruction counts and binary sizes differ between the two, so you only ever replay recipes of your own architecture.
- Enough for the largest sandbox. Of the 23 recipes in this kit, the largest asks for 4 CPUs, 6144 MB of memory and 6144 MB of disk for one container.
- Disk for the toolchain images. Measured on arm64: rust 1.35 GB, go 681 MB, zig 618 MB, cpp 563 MB, python 416 MB. The kit's own image is 543 MB. Add room for repository mirrors and dependency layers under `UNITS_HOME`.
- The one CUDA recipe needs an NVIDIA GPU of the compute capability it names, on a host with no other tenants.

**To join a network**

- A wallet with the network's token for the registration burn and the bond (`params` prints both).

## Config: units.env

One file. A variable already set in your shell wins over it.

| Variable | Meaning |
|---|---|
| `UNITS_NETWORK` | `mainnet` (default) or `devnet`. `--network devnet` switches for one command. |
| `UNITS_SITE_MAINNET`, `UNITS_SITE_DEVNET` | The public site of each network. |
| `UNITS_CORE` | Send every command to this address instead, whatever the network. |
| `UNITS_HOME` | Where the worker keeps mirrors, dependency layers, work directories and the reveals it still owes. **It must be the same absolute path on the host and in the container.** On Docker Desktop use a directory under a shared path such as `/private/tmp/units`. |
| `UNITS_KEY` | The worker key file. Mounted read only. |
| `UNITS_IMAGE`, `UNITS_CONTAINER` | The image this kit builds and the name of the worker container. |
| `UNITS_DOCKER_SOCK` | The host's Docker socket. |
| `UNITS_STOP_TIMEOUT` | Seconds a stopping worker gets to finish and reveal. |
| `UNITS_MAINNET_RPC` | A mainnet RPC address, only for `verify --chain` on mainnet. Keep a keyed address in your shell, not in the file. |

## Check the network yourself

No account, no key, no wallet. These commands only read public data.

### 1. Pick a change

```bash
./units-verifier --network devnet latest --n 3
```

For each accepted change it prints the **generation id**, the **candidate id**, the unit, what was targeted, and its GitHub commit.

### 2. Does the verdict follow from the replays?

```bash
./units-verifier --network devnet verify --candidate <candidate id> --no-draws
```

This downloads the recipe, the calibration and every revealed replay, applies the acceptance rule itself and compares the outcome and its digest with what the network recorded. It trusts nothing the network computed. A matching line reads `ok ... digest ... matches`; a mismatch prints `FAIL` with both values and exits 1.

Leave out `--candidate` to recheck every final change, and leave out `--no-draws` to also recompute how the verifiers were picked: each draw is recomputed from the epoch's revealed secret and a Solana slot hash. Add `--chain` (or `--rpc <url>`) to read those slots from the cluster as well.

### 3. Is the GitHub commit really that change?

```bash
./units-verifier --network devnet verify-generation <generation id>
```

It reads the generation from the network, the commit from GitHub's public API and the git objects with `git fetch`, and checks five things: the commit is the one recorded, its message names this generation with the right patch hash and verdict, it sits on the parent generation's commit, its diff is the accepted patch, and GitHub shows it as verified. `PASS` on every line and `verified` at the end mean it holds. A `WARN` still passes: it marks a parent commit that is not published yet.

GitHub limits anonymous API calls. If you hit the limit, set `GITHUB_TOKEN` in your shell; it only raises the limit.

### 4. Measure it yourself

Steps 2 and 3 prove the record is consistent. This step repeats a measurement on your machine.

```bash
./units-verifier images --build --skip solana      # build the toolchain images once
./units-verifier baseline base58-py-heavy --calibration /path/to/units-recipes/recipes/base58-py-heavy/calibration.json
```

`baseline` builds the repository at the recipe's starting commit in the sandbox, runs its tests and measures every exact metric with the calibration's own seed, then compares with the published file line by line. It ends with `BASELINE MATCHES` or lists what differs. This is the same comparison a qualification makes. The calibration files are in the recipes repository.

`replay --candidate <id>` goes one step further: it runs one final change again in your sandbox with the seed the verifiers used and compares every exact field with what they revealed. It needs a recipe in this kit with the same id as the network's unit. On the public sites that is not the case today (point 2 of "What works today"), and the command says so and stops.

Two things to know when you read the numbers:

- **Counts depend on the architecture.** amd64 and arm64 give different instruction counts and sizes.
- **A locally built image is not the pinned image.** `images` records which of your local builds stands in for which pinned id, and every run says so in its first line. That is right for checking a result yourself, never for answering a network. The counts can differ slightly: on the machine this kit was checked on, a rebuilt python image matched the calibration of `base58-py-heavy` on every metric and missed `base58-py` by 0.12% on one metric, where the tolerance is 0.1%.

## Run a verifier

The steps, for a network whose worker address you have (see "What works today").

### 1. Make a key

```bash
./units-verifier keygen
```

It writes a new key to `UNITS_KEY` (default `keys/agent.json`, ignored by git) and prints its public id. It refuses to overwrite a key. Back the file up: it is the identity your bond and earnings belong to. The file is readable by its owner only; on Linux that owner is root, because the container runs as root.

### 2. Check the machine

```bash
./units-verifier doctor --full
```

It prints the architecture, CPUs and memory Docker gives a sandbox, any NVIDIA GPUs, and which toolchain images are present. This is what the worker will declare to the network. On Docker Desktop the figures are the Docker VM's, not the Mac's.

### 3. Register and bond

Registration is on chain and has two signers: your wallet, which owns the verifier and pays the burn, and the worker key, which proves it is on this machine.

1. Open the network's site, connect your wallet, and go to **Profile**, section **Run a verifier**. Enter the worker's public id. Your wallet signs.
2. The page gives you the half-signed transaction as text. On the worker's machine:

   ```bash
   ./units-verifier cosign --tx <the text> --dry-run     # shows what it would sign, sends nothing
   ./units-verifier cosign --tx <the text>
   ```

   `cosign` refuses anything but a registration that names this key. The key is never the fee payer and never a writable account, so a page cannot spend from it.
3. Bond from the same Profile section. The bond is what you lose part of if you lie; it also sets how often you are drawn, up to the cap.

Against a Core running in its simulated mode (a local network), the same two steps are `./units-verifier register` and `./units-verifier bond --amount <base units>`.

### 4. Start the worker

```bash
./units-verifier run
./units-verifier logs
```

`run` starts the container with `docker compose`: the host's Docker socket, `UNITS_HOME` at the same path inside and out, and the key read only. It restarts on reboot and picks up any reveal it still owed.

### 5. Qualify

On start the worker declares what the machine can run. The network then asks it to reproduce the calibrated baseline of each unit its hardware fits. Passing makes you eligible for that unit. Failing costs nothing: the reason is recorded and it is asked again after a wait (`params` prints it).

### 6. Stop it slowly

```bash
./units-verifier stop
```

On stop the worker takes no new work, finishes the replay it is running and reveals what it committed. That can take minutes. `stop` gives it `UNITS_STOP_TIMEOUT` seconds (900 by default). Docker's own default of 10 seconds would cut it off before it reveals, and **a commitment without its reveal costs you** (see below). Never `docker kill` a worker, and never `docker stop` it without `-t`.

## Health

| Check | Command | Healthy looks like |
|---|---|---|
| The machine | `./units-verifier doctor --full` | Docker reachable, your architecture, the images listed, no notes |
| Your standing | `./units-verifier status` | Your bond, your qualifications, eligible for assignments |
| The worker | `./units-verifier logs` | `qualify` lines that end in `committed in ...`, then replays |
| The code | `./units-verifier source` | The monorepo commit this image was built from |

Your replays show on your agent's page on the site once the changes they judged are final. Until then they are sealed, like everything else.

## How slashing works

Every row is charged against the bond you posted. The percentages are network parameters: `./units-verifier params` prints the live ones.

| What you did | What happens |
|---|---|
| Accepted a canary | Slash, and a strike. |
| Landed in the minority on an exact number | Slash, and a strike. |
| Revealed something other than what you committed | Slash, and a strike. |
| Took an assignment and never committed | No slash, but a strike. |

- **Canaries** are known-bad changes the network slips in among real ones. They look like any other change. A verifier that approves without really running the code will sooner or later approve one.
- **Minority** applies to exact numbers only: instruction counts, compute units, bytes. If the other verifiers agree with each other and you do not, you are the one who is wrong.
- **Strikes** add up within an epoch. Reach the limit and you are suspended for the next epoch.
- **Audits** come later: a share of accepted changes is replayed again on a fresh seed. A contradiction slashes whoever was wrong.
- Slashes on one verifier within one epoch are capped; a slash past the cap waits for the next epoch.
- **Unbonding** stops new assignments at once. The bond is released after a cooldown from your last involvement.
- A slash you believe is wrong can be challenged with a bond of your own; it is then recomputed, or replayed again by other verifiers.

An honest machine that reproduces the calibration has nothing to fear from any of this. The cases that hurt honest operators are practical: a worker killed before it revealed, or a toolchain image that is not the pinned one.

## Security

- **The Docker socket is root on the host.** Anything that can reach it controls the machine. Run the worker on a host that does nothing else and holds no other keys. Prefer rootless Docker and point `UNITS_DOCKER_SOCK` at its socket.
- **Sandboxes are locked down.** Each build, test and measurement runs in its own container with no network, a read-only root, no capabilities, a non-root user, and CPU, memory, process and time limits. Only the `prepare` step of a recipe has network.
- **The key is mounted read only**, and only the key.
- **Cleaning up.** Sandbox containers carry the labels `units=1` and `lineage=1`. Remove leftovers with `docker ps -aq --filter label=units=1 | xargs docker rm -f`. Never prune globally on a machine you share. Everything under `UNITS_HOME` except `worker/` is a cache and safe to delete while the worker is stopped; `worker/` holds the reveals it still owes.

## Updating

```bash
./units-verifier stop          # slowly: let it reveal
git pull
./units-verifier build
./units-verifier run
```

The code the image runs is in `vendor/`. It is a snapshot of the units monorepo, written by that repository's `scripts/public/export-verifier.ts` from one commit; `vendor/SOURCE.json` names the commit and the sha256 of every file. It is not edited here. It holds only what the worker and the tools load: the worker, the sandbox, the protocol rules, the recipes with their measurement harnesses, and the toolchain image build files.

A network that changes its rules will need verifiers on the matching snapshot. Watch this repository for new commits.

## Troubleshooting

| You see | What it means |
|---|---|
| `image units/verifier:local is not built` | Run `./units-verifier build`. |
| `docker not reachable` from `doctor` | The socket at `UNITS_DOCKER_SOCK` is missing or not readable. |
| A sandbox fails with a mount error or an empty tree | `UNITS_HOME` is not the same path on the host and in the container, or (Docker Desktop) not under a shared directory. |
| `image not available: lineage/...` | The toolchain image is not on this machine. `./units-verifier images --build`. |
| `recipe ... not in your local recipes/ directory` or `has no active unit with this recipe id` | The network's unit pins another image or architecture than this kit's recipe (point 2 of "What works today"). |
| `gate: method_not_allowed` (HTTP 405) on `register`, `bond` or `run` | You are pointed at a public site address, which answers reads only (point 1). |
| HTTP 429 | The site limits requests per address. Wait and try again; `verify` waits by itself. |
| Qualification keeps failing | The image must be the exact one the recipe pins, and nothing else should be loading the machine. |

## Licence

No licence file has been chosen for this repository yet. Until one is added, the usual rule applies: you may read it, but no other right is granted.

## Where to ask

Open an issue on this repository. The full documentation, including how verification, sealing, epochs and challenges work: [docs.units.gg](https://docs.units.gg).
