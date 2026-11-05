# The UX check: the served screen, measured

Load after the served check (`served-check.md`), before the live check, and when the UX check
stops.

The gates before it check the code. The live check is a person looking at a loaded screen, and a
loaded screen hides how it got there: a screen that reads the server once per row, waits seconds
behind skeletons, moves its content when they turn into controls, logs errors, or draws two
buttons with the same words in one card. All of those passed every gate once and were found by
eye. This check measures them on the served build and stops on a number over its threshold.

## What it measures

Per step (a page opened, or the first click a user makes on it):

| key in `uxCheck` | default | what |
| --- | --- | --- |
| `firstContentMs` | 1000 | ms to the first text drawn inside `main` that is not a skeleton |
| `lastSkeletonMs` | 3000 | ms to the last skeleton gone; one still showing at idle stops |
| `gqlPosts` | 10 | `/gql` POSTs from the step's start until idle, with each operation's count |
| `layoutShift` | 0.1 | cumulative layout shift, the browser's metric (0.1 is its "good" bound) |
| `consoleErrors` | 0 | `console.error` calls, uncaught errors and rejections |
| `failedRequests` | 0 | requests answered 400 or over, or not answered |

For the finished screen:

| key | default | what |
| --- | --- | --- |
| `duplicateNames` | 0 | two focusable controls with one accessible name inside one card, else one form section (`fieldset`, `section`, a group) |

And the waits: `idleMs` (1500, the quiet with no DOM change in `main` and no `/gql` call that ends a
step), `maxMs` (30000, a step not idle by then stops) and `skeleton` (the kit's
`.animate-pulse` and `[aria-busy="true"]`). Each key left out of the project's `uxCheck` takes the
default; `node "${CLAUDE_PLUGIN_ROOT}/tools/ux-check.mjs" --help` prints them.

## The run

In the desktop app's built-in browser pane, on a tab signed in to `one.host` (the build's
tab), with the pane showing:

1. **Full reload** of the app shell (`/`). That empties the app's query results and loaded
   components. A page cannot empty the browser's HTTP cache; the report says how many of the
   component's files came from it and which sha served them (`served`), so the served check's sha
   is confirmed here too.
2. **Paste the probe**: the text of `${CLAUDE_PLUGIN_ROOT}/tools/ux-probe.js` (or
   `ux-check.mjs --probe`) as one `javascript_tool` call. It holds no mutation, so the tab guard
   lets it run. It wraps `fetch` and `XMLHttpRequest`, watches the DOM, and observes
   `layout-shift` before the page under check is opened.
3. **Each page**: `uxc.open("#/page/<id>")`, then `await uxc.stop()`. The route is a hash, so the
   document and the probe stay. Open the page from another one; a hash the tab already shows
   opens nothing.
4. **The first click**: `uxc.start("<label>")`, then the click (`computer` on a `find` ref), then
   `await uxc.stop()`. The step starts at the click. Only opens and selections: never a save, a
   sign or a confirm, and only on the user's own test record.
5. `uxc.names()` on the finished screen, then `uxc.report()`: write its answer to
   `.scratch/ux-check.json` in the component repo. The report is compact (lists cut at five);
   `uxc.full()` has them whole, and `uxc.sink()` carries it to `tools/probe-server.mjs`'s sink
   when it is longer than the browser tool returns.
6. `node "${CLAUDE_PLUGIN_ROOT}/tools/ux-check.mjs" .scratch/ux-check.json` from the project
   folder (it reads `.claude/bluestep-one.json`; `--config` for another). Exit 0 passes the gate.

## What stops, and what then

Exit 1 prints one line per number with its threshold, `OVER` on each one over, and what the probe
saw beside it: the operations behind a `/gql` count, the elements of the largest shifts, the
duplicate names and their card. A step with no content, a skeleton still showing at idle, a step
never idle, or a screen not scanned for names stops too.

- **Fix it and publish again** (gates 2 to 7, then this one). Many reads of one operation
  (the same operation counted once per row, `<operation> ×20`) is one read per row: batch it, or read it when the row opens. A shift
  when skeletons resolve: give the skeleton the size of what replaces it. Two controls with one
  name: name each by what it does.
- **A number the screen cannot meet yet**, for a cause outside the component (a server read with
  no batch form): raise that one key in the project's `uxCheck`, write the reason where the
  project keeps its design decisions, and report the missing server read to the platform team.
  Lower it again once the server serves it. Never raise a
  key to pass a run without that reason.

## Known limits

- **A hidden pane paints no frame**, and the browser then sends no `layout-shift` entries
  (`frames: false` in the report). The probe samples the position of every leaf box after each DOM
  change instead and computes the shift the same way, marked `sampled`. It misses a shift that
  comes and goes between two samples. A sampled number near the threshold is no pass: show the
  pane (Ctrl+Shift+B in the app) and run again. Times from a hidden pane can be slower than a
  user's, never faster.
- **Accessible names are computed by the probe**, from `aria-labelledby`, `aria-label`, labels,
  text and `title`, which covers the kit's controls. A control with no name at all is counted in
  `unnamed` as a note, not a stop.
- **One run, one network.** Timings vary between runs; the gate takes one run. A time a few
  percent over its threshold is run once more before it is fixed.
