---
name: release-email
description: Draft and queue a BlueStep-branded release-update email across three products (the bluestep-tools plugin, the b6p CLI, and the gateway MCP) since the last-sent watermarks. Maintainer-only, repo-local, manual — reads watermarks over the gateway MCP, collects changes (CHANGELOG / gh / ClickUp), renders the email-safe template, queues an entry on the BlueHQ outbox form behind an in-session approval gate, drives the test send, and hands the human the signature step that performs the real send on the platform. Never automatic; the agent can never send.
---

# /release-email — Draft and queue the release-update digest

A repo-local **maintainer** skill (same tier as `.claude/skills/bspecs-triage/`, **not** shipped in
`plugin/`). It builds a short, on-brand email covering what changed in the `bluestep-tools` plugin,
the `b6p` CLI, and the **gateway MCP**, then queues it as an **entry on the BlueHQ outbox form**.
The platform does every send: a **post-save formula** on that form sends the test preview when the
test checkbox is saved, and sends the **real** email when — and only when — a human **signs the
Approval signature field** on the entry.

**Manual only.** No release hook, cron, or polling — run this by hand when a digest is worth
sending. **The agent cannot send at all**: MCP writes don't fire the platform's save formulas
(verified), so even the test send needs a human Save in the UI, and the real send needs a human
signature. Nothing in this skill can reach the real recipient list.

Read the governing ADR [`docs/decisions/release-update-email.md`](../../../docs/decisions/release-update-email.md)
(especially its 2026-08-27 and 2026-09-23 addenda) for *why* this shape, and
[`docs/bluehq-release-email-endpoint-setup.md`](../../../docs/bluehq-release-email-endpoint-setup.md)
for what exists on the platform.

## What ships with the skill

- `templates/email.html` + `templates/AUTHORING.md` — the email template and how to fill it.
- `templates/emailShell.ts` — `wrapEmailDocument(body, subject)`. The **same file** is deployed in
  the platform's Send post-save and Preview merge report; keep the three copies identical.
- `scripts/draft.mjs` — `writeDraft(dir, base, { html, text, subject, payload })`: cuts the stored
  body out of the rendered email and proves the shell rebuilds it byte for byte.
- `scripts/outbox.mjs` — every gateway call the run makes: `watermarks`, `list`, `check` (read
  only); `queue`, `rewrite` (writes). Run it with **Git Bash** `node` — `$B6PT_TOKEN` is set there,
  not in WSL.
- `ids.local.json` (gitignored; copy `ids.example.json`) — the org, record, form and field ids.
  It lists only the fields the script may touch, so the script *cannot* read the recipient memos
  or read/write the signature.
- `assets.local.json` (gitignored; copy `assets.example.json`) — `logoUrl`, `releaseUrl`.

## Hard rules (read first)

- **Never read the `recipients` or `testRecipients` fields** on the config form — through any read
  path (GraphQL, the UI, anything else). Recipient addresses must never enter a session, the repo,
  or an outbox entry. The watermark and sender-identity fields are fine to read.
- **Never write the signature field** (`approvalSignature`). The real send is a human-only
  platform action. (The platform refuses such writes anyway; do not attempt them.)
- **Never read the signature field either** — the platform crashed server-side serializing it
  (2026-08); leave it out of every query. `ids.local.json` has no entry for it on purpose.
- **Every MCP write is echoed and approval-gated in-session** (tool + target + a content summary),
  per the `bluestep-reference` `mcp-platform-authoring` procedure. Each `outbox.mjs queue` /
  `rewrite` run is one such write.
- **"Signed = armed."** Any UI save of a signed, not-yet-sent entry performs the real send — not
  just the signing save. Warn the human whenever a signed-or-stale unsent entry exists, and never
  leave scratch/abandoned entries around unsigned cleanup.
- **No recipient address ever lands in the repo.** History files carry counts, never lists.
- **Don't mention platform tool removals in the email.** The platform removed some MCP data tools
  on purpose; that is not tooling news for this list.

## Steps

### 1. Preconditions

Confirm all of these before doing anything. If any is missing, stop with a clear message and
change nothing. **Fail closed — never draft a digest that silently drops a product.**

- **`gh` is installed and authenticated** (`gh auth status`) — the CLI product depends on it.
- **`$CLICKUP_TOKEN` works** — the MCP product depends on it. Verify with a cheap authorized call
  (e.g. `curl -s -o /dev/null -w '%{http_code}' -H "Authorization: $CLICKUP_TOKEN" https://api.clickup.com/api/v2/user`
  → expect `200`). Note the WSL/`~/.profile` sourcing gotcha if it comes back empty.
- **The gateway answers for the owning org** — `node scripts/outbox.mjs watermarks` (Git Bash)
  prints the three watermarks. If it fails, fix `$B6PT_TOKEN` or `ids.local.json` first.
  **There is no manual fallback for queuing** — the `emailHtml` field is hidden on purpose, and
  hand-pasting HTML through the form editor mangles it, so never instruct the human to complete an
  entry by hand. On failure: keep the draft in the scratch dir (nothing is lost), fix the
  connection, resume at the queue step.
- **Shell note:** `gh` and `$CLICKUP_TOKEN` live in WSL, `$B6PT_TOKEN` lives in Git Bash — run
  `gh`/`curl` via `wsl -e bash -lc '…'` and `outbox.mjs` with Git Bash `node`.
- **`assets.local.json` and `ids.local.json` exist.** If `logoUrl` is unset, drop the logo `<img>`
  tags; if `releaseUrl` is a placeholder, flag it.

Work in a gitignored scratch dir (`.release-email/`) so nothing intermediate is tracked.

### 2. Read the watermarks and the outbox

`node scripts/outbox.mjs watermarks` reads `lastPluginVersion`, `lastCliVersion`, `lastMcpSent`
from the config form (GraphQL `singleEntryFieldData`, one field each). Empty watermarks mean
"first run covers everything" — surface that loudly before drafting.

`node scripts/outbox.mjs list` lists every outbox entry with `sentAt`/`sendResult`. **Warn about
any unsent entry** — a queued-but-unsigned entry means a previous run is still pending: its version
ranges go stale the moment a newer entry sends, and if it is *signed*-unsent it is armed. Ask
before queuing another (`queue` refuses while one exists).

The watermarks are **not** edited by hand before a send: they are the "from" of each range, and
the real send advances them itself from the entry's `payloadJson.toVersions`.

### 3. Collect changes, per product

Diff each product against its own watermark. Keep only **user-facing** changes.

- **Plugin** — parse the local `CHANGELOG.md`: `## [plugin X.Y.Z]` blocks newer than
  `lastPluginVersion`, their `### Added/Changed/Fixed` entries. Newest version in range =
  `toVersions.plugin`. *(Coupling: the `## [plugin X.Y.Z]` header shape.)*
- **CLI** — `gh release list --repo Bluestep-Systems/b6p-cli`, then `gh release view <tag>` for
  each release newer than `lastCliVersion`. Newest in range = `toVersions.cli`. Re-check `gh`
  here; stop before drafting if it fails. *(Coupling: the `gh` release shape.)*
- **MCP** — ClickUp REST (the repo's bulk-read convention — direct `curl` with `$CLICKUP_TOKEN`,
  **not** the ClickUp MCP server):

  ```bash
  curl -s -H "Authorization: $CLICKUP_TOKEN" \
    "https://api.clickup.com/api/v2/team/1282031/task?space_ids%5B%5D=90144479373&tags%5B%5D=mcp&include_closed=true&date_closed_gt=<lastMcpSent as epoch-ms>&page=0"
  ```

  Paginate until `last_page` is true. Keep tasks whose status type is **closed**; task names (and
  descriptions when a name is too terse) become the entry notes, filtered to user-facing changes.
  `toVersions.mcp` = the **max `date_closed`** among included tasks, as ISO-8601. An empty
  `lastMcpSent` = first run; omit `date_closed_gt` and filter closed-only.

If **all three** ranges are empty, report *"nothing new since plugin `<x>` / cli `<y>` / mcp
`<z>`"* and **stop** — the natural idempotent no-op. A subset being empty just drops that
product's section; only present products go into `toVersions` (only their watermarks will move).

### 4. Draft and render

Read the template `.claude/skills/release-email/templates/email.html` (see `templates/AUTHORING.md`
for tokens, marked regions, and optional blocks) and render it with a throwaway script in the
scratch dir — never edit the template itself.

- `[SUBJECT]` (+ `<title>`), `[OVERLINE]` (`Tooling update` when multiple products changed;
  otherwise `Plugin update` / `CLI update` / `MCP update`), intro prose, `[LOGO_URL]` /
  `[RELEASE_URL]` from `assets.local.json`.
- Clone the `PRODUCT_SECTION` block per product with changes; clone the `ENTRIES` row per entry.
  - Plugin section: `[UPDATE_INSTRUCTION]` = `/plugin marketplace update`; version cell = version.
  - CLI section: the b6p-cli update command; version cell = version.
  - **MCP section:** `[PRODUCT_NAME]` = "BlueStep gateway MCP"; **no update instruction** —
    replace that block with a line saying the changes are already live server-side; version cell =
    a short close date (e.g. `Aug 27`).
- Footer: plain and honest, no `[RECIPIENT]`/`[OPT_OUT]` merge tokens ("You're on the BlueStep
  tooling update list. Reply to unsubscribe.").
- Also write the **plain-text alternative**. Strip every comment except the two MSO ghost-table
  conditionals in the body and the one in `<head>`. No flexbox/grid/gap/SVG (see AUTHORING.md).
- **Write apostrophes as a plain `'`**, never `&#39;` — the platform decodes it on write, so the
  stored body would no longer match. The template's own sample intro uses `&#39;`; it is replaced.
- Build the payload: `{ "fromVersions": {…}, "toVersions": {…} }` with only the products that
  changed (`plugin`/`cli` version strings, `mcp` ISO timestamp).
- Finish with `writeDraft(".release-email", "<YYYY-MM-DD>", { html, text, subject, payload })`
  from `scripts/draft.mjs`. It throws if the body still holds anything the platform would alter,
  or if `emailShell.ts` no longer matches the template's `<head>` — then fix the render or the
  shell (and redeploy the shell to both components) before going on.

### 5. Queue the outbox entry — approval gate #1

Show the user in-session: the subject, the rendered email (and text alternative), the version
ranges, and the target (org + outbox form). **Wait for explicit approval.** On decline: stop —
nothing was written anywhere.

On approval, run `node scripts/outbox.mjs queue .release-email <YYYY-MM-DD>`. It creates the entry
(GraphQL `createFormRow` on the office record: `subject`, `emailHtml` = the body, `emailText`,
`payloadJson`), reads it back, and byte-compares every field **and** that
`wrapEmailDocument(stored body, subject)` equals the rendered email. Any mismatch → stop and
investigate; nothing may send from a corrupt entry. Agents cannot delete rows: fix the entry in
place with `outbox.mjs rewrite <entry> …` (after the human confirms it is not signed), or ask the
human to delete it in the UI.

Tell the human where the entry lives (the office record → the outbox form → the new entry) — the
embedded **Email Preview** merge report on the entry renders exactly what Send will email.

### 6. Test send — approval gate #2, human-fired

The test send goes **only** to the config form's `testRecipients`, with `[TEST] ` in front of the
subject (the real send has no prefix). MCP writes don't fire the post-save, so the human does it:
open the entry, check the preview, **tick the test-send checkbox and Save**. The post-save sends the test,
stamps `testSentAt`, clears the checkbox.

The human validates the email in their **real inbox** (Outlook + Gmail: rendering, the
"on behalf of" label, the logo). `outbox.mjs check <entry> …` confirms `testSentAt`/`sendResult`.
An empty-`testRecipients` refusal shows up in `sendResult`; fix the config form and repeat. A
content fix after the test: re-render, `rewrite`, test again.

### 7. Hand off the real send — the signature

The skill does **not** perform the real send and must say so explicitly. Wrap up by telling the
human:

> The entry is queued and test-validated. To send for real: open the entry, check the preview one
> last time, **sign the Approval field, and Save**. That save emails the full `recipients` list,
> advances the watermarks, and permanently locks the entry (`sentAt`). Signing is irreversible in
> effect — a signed, unsent entry sends on its next save, whoever saves it.

If they report a refusal in `sendResult` instead (empty `recipients`, bad payload), help fix the
config/entry — a refused entry stays sendable; `sentAt` is only stamped by an actual send.

### 8. Record

After the human confirms the real send, run `outbox.mjs list` and `outbox.mjs watermarks` to see
`sentAt`, the counts in `sendResult`, and the advanced watermarks. Then write two files under
`.claude/skills/release-email/sent/`, same basename
`<YYYY-MM-DD>-plugin<vA>-cli<vB>-mcp<date>` (drop the token for a product not in the send):

- `….md` — the ranges per product, test and real send times, subject, sent and failed counts, the
  watermarks after. **No addresses, no names.**
- `….html` — the sent document (`<base>.html` from the draft) with the logo URL put back as
  `[LOGO_URL]` — this repo is public and the logo URL is org-specific.

Then **propose a commit** for those two files. Do not run `git commit` unless told.

## Edge cases (quick reference)

- **Some products empty** → their sections are dropped and their watermarks stay put; the entry's
  `toVersions` names only what changed.
- **All empty / re-run** → report and stop (idempotent).
- **`gh` or `$CLICKUP_TOKEN` missing/broken** → stop *before* drafting.
- **A queued unsent entry already exists** → warn at step 2; signed-unsent means ARMED.
- **Round-trip mismatch** → abort the run; investigate before anything can send.
- **Partial real-send failures** → watermarks still advanced (the digest went out);
  `sendResult` carries counts/reasons only; never re-blast, never write failures to a file.
- **A sent entry** (`sentAt` set) → inert forever; re-saves and re-signs are no-ops by design.
- **Stale local history** → harmless; the config form's watermark fields are the source of truth.
  Never "fix" a watermark by editing a history file — fix the form field.
- **Fresh-org rebuild** → the provisioning checklist is
  [`docs/bluehq-release-email-endpoint-setup.md`](../../../docs/bluehq-release-email-endpoint-setup.md).

## Platform behavior this depends on (verified 2026-09-23)

- **Every write path alters full HTML documents** — GraphQL `createFormRow`/`updateFormRow` and UI
  saves alike, on any field type: `<html>`/`<head>`/`<body>`/`<meta>`/`<link>`/`<title>` are
  renamed (`<xxhtmlxx>` …), HTML comments (MSO conditionals too) are escaped, `&#39;` becomes `'`.
  Tables, spans, inline styles, `<style>` and other entities come through byte for byte. That is
  why the entry stores the body only and `emailShell.ts` adds the rest back at send time.
- **`memoFormatType` cannot be changed on an existing field** — the platform refuses it.
- **Agents cannot delete form rows.** Every failed write leaves an entry: reuse it with `rewrite`
  or have the human delete it.
- Entries written before 2026-09 hold full documents; `wrapEmailDocument` passes anything starting
  with `<!doctype` through unchanged.

## Known gaps / open items

- **`releaseUrl`** in `assets.local.json` is a placeholder until the full release-notes page
  exists.
- **No per-recipient opt-out** — the footer stays generic ("reply to unsubscribe"); a real
  suppression list + unsubscribe link is a deferred open item.
- **`queue` and `rewrite` are untested as a pair of commands** — the calls they make were proven
  one by one in the 2026-09-23 run; the first real use should be watched.
