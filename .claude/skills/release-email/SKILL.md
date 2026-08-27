---
name: release-email
description: Draft and send a BlueStep-branded release-update email across both products (the bluestep-tools plugin + the b6p CLI) since the last-sent watermark. Maintainer-only, repo-local, manual — probes a restricted BlueHQ endpoint, collects changes, renders the email-safe template, gates on in-session approval, POSTs to the endpoint, and writes a no-addresses history file. Use when you want to tell users what changed and how to update. Never automatic.
---

# /release-email — Send the release-update digest

A repo-local **maintainer** skill (same tier as `.claude/skills/bspecs-triage/`, **not** shipped in
`plugin/`). It builds a short, on-brand email that tells users what changed in the `bluestep-tools`
plugin **and** the `b6p` CLI since the last send, and how to update each. The skill drafts and
renders; a restricted BlueHQ endpoint does the actual per-recipient send with the recipient list and
send secrets held server-side.

**Manual only.** There is no release hook, cron, or polling — you run this by hand when a digest is
worth sending, and nothing goes out without your explicit in-session approval.

Read the governing ADR [`docs/decisions/release-update-email.md`](../../../docs/decisions/release-update-email.md)
for *why* the split exists, and the setup guide
[`docs/bluehq-release-email-endpoint-setup.md`](../../../docs/bluehq-release-email-endpoint-setup.md)
for the field names and the exact probe/send/response contract this skill codes against.

## The credential boundary (read this first)

**The Basic Auth credential must never enter a Claude session.** That is a hard rule, and it shapes
the whole flow below:

- **The agent (Claude) never reads `.env`, never runs the authenticated `curl`, and never sees or
  prints the credential.** Do not `cat`/`grep`/`source` `.claude/skills/release-email/.env`, do not
  run the probe or the send, do not `echo` the credential or its base64.
- **The human runs every authenticated call** (the probe in step 2, the send in step 6) in their
  **own** terminal, where their shell reads `.env`. The agent *generates* the exact command + the
  `payload.json` (which contains no secret) and hands them over; the human runs them and pastes back
  the JSON response for the agent to parse.
- **Why (do not rewire this to auto-run):** the credential is a live send credential for the whole
  user list. HTTP Basic Auth is reversible base64, not a hash — so any command the agent runs with
  it, or any read of `.env`, puts the real secret in this session's blast radius. Keeping the
  authenticated calls human-run is the only thing that removes that risk. Prefer a **scoped,
  revocable token / service account** over a personal password, so even a slip is contained.

## What this skill will NOT do

- **Never write a recipient address to the repo.** The address list lives *only* in the endpoint's
  memo field. History files carry a recipient **count**, never a list. Per-address send failures are
  surfaced only in the human-run response and are **never** written to a file.
- **Never hand-edit a history file to "fix" a version range.** The watermark is
  **server-authoritative** — the form fields on the endpoint are the source of truth. Always
  re-probe; a stale local checkout is harmless.
- **Never hardcode the endpoint URL or credential in a committed file.** Both live in the
  gitignored `.claude/skills/release-email/.env` (copied from `.env.example`), keeping the
  org-specific URL and the secret out of this public repo — and, per the boundary above, out of the
  session.

## Steps

### 1. Preconditions

Confirm all of these before doing anything. If any is missing, stop with a clear message and change
nothing.

- **`gh` is installed and authenticated** (`gh auth status`). The CLI half of the digest depends on
  it — see step 3. Without it, stop before drafting (do **not** send a plugin-only email that
  silently drops CLI news).
- **`.env` exists** — `.claude/skills/release-email/.env` (gitignored; the human copies it from
  `.env.example` and fills in `B6P_RELEASE_EMAIL_URL` + `B6P_RELEASE_EMAIL_AUTH`). Confirm only that
  the **file is present** — do **not** read, cat, grep, or source it (the credential boundary above).
  The human's shell reads it when *they* run the authenticated commands.

  ```bash
  test -f .claude/skills/release-email/.env && echo present || echo "missing — copy .env.example to .env and fill it in"
  ```

  If missing, stop: *"create `.claude/skills/release-email/.env` from `.env.example` and set both
  values (see docs/bluehq-release-email-endpoint-setup.md §3b)."*

Work in a gitignored scratch dir so nothing intermediate is tracked:

```bash
mkdir -p .release-email && cd .release-email
# add .release-email/ to .git/info/exclude if it isn't already ignored
```

### 2. Probe the endpoint — **human-run**

`GET ?probe=1` returns the current watermarks + recipient count **without sending** and **without
ever returning the addresses**. Per the credential boundary, **the agent does not run this** — it
prints the command for the human, who runs it in their own terminal and pastes the JSON back.

Agent: hand the human this block verbatim (it reads `.env` in *their* shell; nothing is expanded
here):

```bash
set -a; . .claude/skills/release-email/.env; set +a
curl -sS "$B6P_RELEASE_EMAIL_URL?probe=1" \
  -H "Authorization: Basic $(printf %s "$B6P_RELEASE_EMAIL_AUTH" | base64 | tr -d '\n')"
```

Ask the human to paste the JSON response. Parse `{ watermark:{plugin,cli}, recipientCount, froms,
sender, replyTo }` from what they paste, and show them the **recipient count** and **current
watermarks**. Interpret the outcome the human reports:

- **`401`/`403`** → the credential is missing/wrong or lacks access. Ask them to check
  `B6P_RELEASE_EMAIL_AUTH` in `.env`; write no history, change nothing.
- **Empty `200`** → the endpoint likely needs a snapshot (compile + publish); see setup guide §5.
  Stop and report.
- **Unreachable / other error** → report and stop.

### 3. Collect changes, per product

Diff each product independently against its own watermark. Keep only **user-facing** changes.

- **Plugin** — parse the local `CHANGELOG.md`. Take the `## [plugin X.Y.Z]` version blocks **newer
  than `watermark.plugin`** up to HEAD, and pull their `### Added` / `### Changed` / `### Fixed`
  (etc.) entries. Prefer reporter-facing changes; skip internal-only churn. The newest plugin
  version in range becomes the plugin `toVersion`. *(Coupling: this depends on the
  `## [plugin X.Y.Z]` header shape — note it if the changelog format ever drifts.)*
- **CLI** — list `b6p-cli` releases newer than `watermark.cli`:

  ```bash
  gh release list --repo Bluestep-Systems/b6p-cli
  gh release view <tag> --repo Bluestep-Systems/b6p-cli   # for the changelog body of each in range
  ```

  Filter to user-facing changes; the newest release in range becomes the CLI `toVersion`.
  **Fail closed:** if `gh` is unavailable or unauthenticated (it should have been caught in step 1,
  but re-check here), **stop before drafting** — never ship a plugin-only email that drops CLI news.
  The documented fallback is a public raw-URL fetch of the `b6p-cli` changelog, but prefer `gh`.
  *(Coupling: this depends on the `gh` release shape.)*

If **both** ranges are empty, report *"nothing new since plugin `<x>` / cli `<y>`"* and **stop** —
that is the natural idempotent no-op.

### 4. Draft and render

Read the template `.claude/skills/release-email/templates/email.html` (see its sibling
`templates/AUTHORING.md` for the placeholder tokens and marked regions) and produce the finished
HTML in a **working file** in the scratch dir — never edit the template itself.

- Set `[SUBJECT]` (also the `<!-- SUBJECT: ... -->` comment on line 1 and the `<title>`).
- Set `[OVERLINE]` to fit what changed — `Tooling update` when both changed, `Plugin update` or
  `CLI update` when only one did.
- Replace the `<!-- INTRO -->` sample paragraphs with the lead prose (plain, friendly, short).
- For **each product that changed**, clone the `<!-- PRODUCT_SECTION:START -->` … `:END -->` block:
  set `[PRODUCT_NAME]` (e.g. `bluestep-tools plugin`, `b6p CLI`), set `[UPDATE_INSTRUCTION]`
  (plugin → `/plugin marketplace update`; CLI → the `b6p-cli` update command), and clone the
  `<!-- ENTRIES:START -->` … `:END -->` row **once per entry** (version cell + text cell). **Delete
  the sample entries** and any product section with no changes.
- Fill `[LOGO_URL]` and `[RELEASE_URL]` from **`.claude/skills/release-email/assets.local.json`**
  (`logoUrl` / `releaseUrl`). This is a **non-secret** gitignored config the agent CAN read (it holds
  no credential — the secret stays in `.env`, which the agent never reads). If `assets.local.json`
  is missing, copy it from `assets.example.json`; if `logoUrl` is unset, drop the two logo `<img>`
  tags (the wordmark carries the header); if `releaseUrl` is a placeholder, note it.
- **Footer:** there's no per-recipient merge, so give the footer a plain, honest line (no
  `[RECIPIENT]`/`[OPT_OUT]` tokens) — e.g. "You're on the BlueStep tooling update list. Reply to
  unsubscribe."
- **Optional blocks** — when a release needs more than the standard product sections (a breaking
  change, action-required steps, a screenshot, a click-to-play video), copy the matching **email-safe
  block from `AUTHORING.md` → "Optional blocks"**, fill its tokens, and paste it at the right spot.
  Images must be **hosted public URLs** (see AUTHORING.md → "Images & hosting"); never inline a local
  file, and video is a poster-that-links-out, not embedded playback.
- Also write a **plain-text alternative** (`text`) — a readable, link-preserving version of the same
  digest for clients that don't render HTML.
- After rendering, **strip non-MSO HTML comments** so template notes don't ship in the email (keep
  the `<!--[if mso]> … <![endif]-->` Outlook conditionals).

Do not reintroduce flexbox / grid / gap / SVG (see `AUTHORING.md`); the template is email-safe and
must stay that way.

### 5. Show for approval — the gate

Show the user, in-session:

- the **subject**,
- the **rendered body** (and the plain-text alternative),
- the **recipient count** and the **test-recipient count** from the probe (if `testRecipientCount`
  is 0, tell them to add addresses to the `Test Recipients` field before the preview send).

**Wait for explicit approval to start the preview.** On decline: stop — nothing is POSTed, no
watermark moves, no history file is written. This mirrors `/bspecs-feedback` and `/spec-execute`.

### 6. Preview → real — a two-phase, human-run send

The endpoint has a **preview mode**: `test: true` sends to the `Test Recipients` field (the
maintainer's own validation addresses) and does **not** advance any watermark; `test: false` sends
to the real `Recipients` and advances the watermark. Always do the preview first, let the human
validate the *actual* email in their inbox, then do the real send as a separate gate.

Per the credential boundary, the **agent builds `payload.json`** (no secret — just versions,
subject, HTML, text) and hands over the command; **the human runs it** in their own terminal.
Include only the product(s) that changed — the endpoint advances only the watermark(s) present in
the payload.

**6a. Preview send** — agent writes `payload.json` with `"test": true` (use `jq` so the HTML/text
encode safely), then hands the human:

```bash
set -a; . .claude/skills/release-email/.env; set +a
curl -sS "$B6P_RELEASE_EMAIL_URL" \
  -H "Authorization: Basic $(printf %s "$B6P_RELEASE_EMAIL_AUTH" | base64 | tr -d '\n')" \
  -H "Content-Type: application/json" \
  --data @payload.json
```

The human runs it, then opens the email in **their inbox** (Outlook + Gmail) and checks it renders
as the real thing. If empty-`Test Recipients`, the endpoint returns a clear error — they add
addresses and re-run. Ask them to paste the response and confirm the email looks right.

**6b. Real send** — a **separate approval gate**. Only after the human confirms the preview, the
agent flips the payload to `"test": false` (same file, re-`jq`'d) and hands over the **same command**
again. The human runs it; the real recipients get the digest and the watermark(s) advance.

Both phases return `{ ok, sentCount, failures:[{email,error}], watermark }` (the preview also echoes
`test:true`). Show `sentCount` + the new `watermark`; per-address `failures` are for the human's
follow-up and are **never** written to a file.

### 7. Record

On a successful (non-test) response, write two files under `.claude/skills/release-email/sent/`,
same basename:

- `sent/<YYYY-MM-DD>-plugin<vA>-cli<vB>.md` — the ranges (`from`→`to` for each product), sent-at
  timestamp, subject, recipient **count**, and failure **count**. **No addresses.** (If a product
  wasn't in this send, note it as unchanged rather than inventing a range.)
- `sent/<YYYY-MM-DD>-plugin<vA>-cli<vB>.html` — the exact rendered HTML that was sent (the footer is
  generic — there is no per-recipient merge yet; see the open item below).

Then **propose a commit** (title + body) for those two files. Do **not** run `git commit` — leave
that to the maintainer.

## Edge cases (quick reference)

- **One product empty** → a single-section email; only that product's watermark advances.
- **Both empty / re-run** → report and stop (idempotent).
- **`gh` missing/unauthed** → stop *before* drafting; fix `gh` and re-run. Raw-URL fetch is the
  documented fallback.
- **Partial send failures** → the watermark still advanced (the digest went out); failed addresses
  are shown in-session for manual follow-up, never re-blasted, never written down.
- **`401`/`403` / endpoint unreachable / empty `200`** (from the human-run probe or send) → report
  clearly, write no history, watermarks unchanged.
- **Credential must stay out of session** → the agent never reads `.env` or runs the authenticated
  probe/send; it generates the commands + `payload.json` and the human runs them (see the credential
  boundary at the top).
- **Empty `Test Recipients` on a preview** → the endpoint returns a clear error (it never falls back
  to the real list); add addresses to the field and re-run the preview.
- **Stale local history** (sent from another machine) → harmless; the form fields, not the repo, are
  the range source of truth. Always re-probe.

## Known gaps / open items

- **No hosted logo yet** → the email shows the "BlueStep" wordmark only; hosting a PNG + setting the
  template's `[LOGO_URL]` is a to-do (setup guide §4).
- **No per-recipient opt-out** → the footer is generic ("reply to unsubscribe"); the endpoint does
  not substitute per-recipient `[RECIPIENT]`/`[OPT_OUT]` tokens. A real opt-out (a suppression list +
  an unsubscribe link) is a deferred open item.
