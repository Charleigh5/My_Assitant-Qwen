# ORBIT CLI — self-modification at the source level

The ORBIT console has **two self-modification layers** that share one journal format:

| Layer | Where it runs | What it mutates | Reversible by |
|---|---|---|---|
| **In-app Kernel** (`KERNEL` dock tab) | Browser, at runtime | Live behavior: tempo windows, swing, intent vocabulary, persona accents/lines, scene & avatar physics | `undo` / factory reset in the console |
| **This CLI** | Node on your machine | The actual source files in `src/lib/` | `undo` (journaled) or `git` |

## The loop (Codex / Claude Code style)

```bash
node cli/orbit-cli.mjs plan "make house faster"        # 1. dry-run plan
node cli/orbit-cli.mjs tune music.bpm.house "[128,136]" # 2. apply to source
npm run build                                           # 3. verify
node cli/orbit-cli.mjs undo                             # 4. revert if wrong
```

## Commands

```bash
node cli/orbit-cli.mjs status                          # current source parameters
node cli/orbit-cli.mjs plan "<natural language>"       # dry-run patch plan
node cli/orbit-cli.mjs tune music.bpm.lofi "[80,96]"   # tempo windows
node cli/orbit-cli.mjs tune music.swing.lofi 0.16      # swing 0..0.35
node cli/orbit-cli.mjs intent "vibe check" slower      # extend intent vocabulary
node cli/orbit-cli.mjs accent ember "#FF3B3B"          # persona genetics
node cli/orbit-cli.mjs voice lyra "I hummed a new line for you."
node cli/orbit-cli.mjs title lofi "Kernel Panic Café"
node cli/orbit-cli.mjs apply orbit-kernel-journal.json # import in-app kernel patches
node cli/orbit-cli.mjs log | undo | reset              # journal control
```

## Bridging the two layers

1. Experiment live in the app — talk to the agent ("optimize house tempo",
   "add command 'vibe' to slower", "recolor ember crimson") or use the kernel
   console directly.
2. When a mutation proves out, hit **EXPORT → CLI** in the kernel console.
3. `node cli/orbit-cli.mjs apply orbit-kernel-journal.json` writes the
   surviving patches into source so they ship with the next build.

Runtime-only parameters (`scene.*`, `avatar.*`) stay in the app journal —
they have no source constant by design; the CLI reports them as skipped.

## Safety

- Every commit is journaled in `cli/journal.json` with the exact before/after
  text, and `undo` reverts the last commit (it refuses if the file drifted).
- **Git is the ultimate rollback**: `git diff` to inspect any mutation,
  `git checkout -- src` to nuke everything.
- The CLI never runs the dev server, installs packages, or touches files
  outside `src/lib/`.
