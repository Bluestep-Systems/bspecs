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
(especially its 2026-08-27 outbox addendum) for *why* this shape, and
[`docs/bluehq-release-email-endpoint-setup.md`](../../../docs/bluehq-release-email-endpoint-setup.md)
for what exists on the platform.

## Hard rules (read first)

- **Never read the `recipients` or `testRecipients` fields** on the config form — not via
  `form_entry`, not via GraphQL, not via any read path. Recipient addresses must never enter a
  session, the repo, or an outbox entry. The watermark and sender-identity fields are fine to read.
- **Never write the signature field** (`approvalSignature`). The real send is a human-only
  platform action. (The platform refuses such writes anyway; do not attempt them.)
- **Never include a signature fieldId in a `form_entry` READ** — the platform crashes server-side
  on serializing it. Always pass an explicit `fieldIds` list that excludes it.
- **Every MCP write is echoed and approval-gated in-session** (tool + target + a content summary),
  per the `bluestep-reference` `mcp-platform-authoring` procedure.
- **"Signed = armed."** Any UI save of a signed, not-yet-sent entry performs the real send — not
  just the signing save. Warn the human whenever a signed-or-stale unsent entry exists, and never
  leave scratch/abandoned entries around unsigned cleanup.
- **No recipient address ever lands in the repo.** History files carry counts, never lists.

## Steps

### 1. Preconditions

Confirm all of these before doing anything. If any is missing, stop with a clear message and
change nothing. **Fail closed — never draft a digest that silently drops a product.**

- **`gh` is installed and authenticated** (`gh auth status`) — the CLI product depends on it.
- **`$CLICKUP_TOKEN` works** — the MCP product depends on it. Verify with a cheap authorized call
  (e.g. `curl -s -o /dev/null -w '%{http_code}' -H "Authorization: $CLICKUP_TOKEN" https://api.clickup.com/api/v2/user`
  → expect `200`). Note the WSL/`~/.profile` sourcing gotcha if it comes back empty.
- **The gateway MCP is live for the owning org** — a `describe_tool(form_entry)` sanity check.
  If the tools aren't registered, the fix is enable-plugin + `$B6PT_TOKEN` + fresh session.
  **There is no manual fallback for queuing** — the `emailHtml` field is hidden on purpose, and
  hand-pasting HTML through the form editor mangles it (WYSIWYG), so never instruct the human to
  complete an entry by hand. On MCP failure: keep the rendered draft in the scratch dir (nothing
  is lost), fix the connection, resume at the queue step.
- **Shell note:** `gh` and `$CLICKUP_TOKEN` live in WSL, not Git Bash — run those commands via
  `wsl -e bash -lc '…'` (see the repo's shell conventions).
- **`assets.local.json` exists** (non-secret render config: `logoUrl`, `releaseUrl`). If missing,
  copy `assets.example.json`; if `logoUrl` is unset, drop the logo `<img>` tags; if `releaseUrl`
  is a placeholder, flag it.

Work in a gitignored scratch dir (`.release-email/`) so nothing intermediate is tracked.

### 2. Read the watermarks over MCP

Read the config form entry's **three watermark fields only** — `lastPluginVersion`,
`lastCliVersion`, `lastMcpSent` — via `form_entry` READ with an explicit `fieldIds` list (never
the recipient memos, never more than named). Also read `froms`/`sender`/`replyTo` only if the
sender identity needs confirming. Empty watermarks mean "first run covers everything" — surface
that loudly before drafting (an empty plugin watermark means ~all changelog history).

Also `form_entry` LIST the outbox form (fields: subject, sentAt) and **warn about any unsent
entry** — a queued-but-unsigned entry means a previous run is still pending: its version ranges
go stale the moment a newer entry sends, and if it is *signed*-unsent it is armed. Ask before
queuing another.

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
for tokens, marked regions, and optional blocks) and produce the finished HTML in a working file in
the scratch dir — never edit the template itself.

- `[SUBJECT]` (+ line-1 comment + `<title>`), `[OVERLINE]` (`Tooling update` when multiple
  products changed; otherwise `Plugin update` / `CLI update` / `MCP update`), intro prose,
  `[LOGO_URL]` / `[RELEASE_URL]` from `assets.local.json`.
- Clone the `PRODUCT_SECTION` block per product with changes; clone the `ENTRIES` row per entry.
  - Plugin section: `[UPDATE_INSTRUCTION]` = `/plugin marketplace update`; version cell = version.
  - CLI section: the b6p-cli update command; version cell = version.
  - **MCP section:** `[PRODUCT_NAME]` = "BlueStep gateway MCP"; **no update instruction** —
    replace that block with a line saying the changes are already live server-side; version cell =
    a short close date (e.g. `Aug 27`).
- Footer: plain and honest, no `[RECIPIENT]`/`[OPT_OUT]` merge tokens ("You're on the BlueStep
  tooling update list. Reply to unsubscribe.").
- Also write the **plain-text alternative**. Strip non-MSO comments after rendering. No
  flexbox/grid/gap/SVG (see AUTHORING.md).
- Build `payloadJson`: `{ "fromVersions": {…}, "toVersions": {…} }` with only the products that
  changed (`plugin`/`cli` version strings, `mcp` ISO timestamp).

### 5. Queue the outbox entry — approval gate #1

Show the user in-session: the subject, the rendered body (and text alternative), the version
ranges, and the target (org + outbox form). **Wait for explicit approval.** On decline: stop —
nothing was written anywhere.

On approval, create the entry over MCP (`form_entry` CREATE on the outbox form, on the office
record): `subject`, `emailHtml`, `emailText`, `payloadJson`. Resolve fieldIds with
`describe_form`/`get_form` if not already known. Then **read the entry back** (excluding the
signature field) and **byte-compare `emailHtml`** against what was sent — abort and report on any
mismatch (nothing can send from a corrupt entry; the platform round-trip is normally
byte-faithful).

Tell the human where the entry lives (the office record → the outbox form → the new entry) — the
embedded **Email Preview** merge report on the entry renders the exact stored HTML.

### 6. Test send — approval gate #2, human-fired

The test send goes **only** to the config form's `testRecipients`. Two moving parts, split
human/agent because MCP writes don't fire the post-save:

1. **Agent (gated):** set `testSendRequested = true` on the entry via `form_entry` UPDATE.
2. **Human:** open the entry in the UI, confirm the preview looks right, and **Save** (the
   checkbox is already ticked). The post-save sends the test, stamps `testSentAt`, clears the
   flag. *(Or the human just ticks the box themselves — same thing.)*

The human validates the email in their **real inbox** (Outlook + Gmail: rendering, the
"on behalf of" label, the logo). The agent re-reads `testSentAt`/`sendResult` to confirm the run.
An empty-`testRecipients` refusal shows up in `sendResult`; fix the config form and repeat.

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

After the human confirms the real send (or a watermark re-read over MCP shows the advance), write
two files under `.claude/skills/release-email/sent/`, same basename
`<YYYY-MM-DD>-plugin<vA>-cli<vB>-mcp<date>` (drop the token for a product not in the send):

- `….md` — the ranges per product, sent-at, subject, `sentCount`, failure count. **No addresses.**
- `….html` — the exact rendered HTML that was queued/sent.

Then **propose a commit** for those two files. Do not run `git commit` unless told.

## Edge cases (quick reference)

- **Some products empty** → their sections are dropped and their watermarks stay put; the entry's
  `toVersions` names only what changed.
- **All empty / re-run** → report and stop (idempotent).
- **`gh` or `$CLICKUP_TOKEN` missing/broken** → stop *before* drafting.
- **A queued unsent entry already exists** → warn at step 2; signed-unsent means ARMED.
- **Round-trip mismatch on `emailHtml`** → abort the run; investigate before anything can send.
- **Partial real-send failures** → watermarks still advanced (the digest went out);
  `sendResult` carries counts/reasons only; never re-blast, never write failures to a file.
- **A sent entry** (`sentAt` set) → inert forever; re-saves and re-signs are no-ops by design.
- **Stale local history** → harmless; the config form's watermark fields are the source of truth.
  Never "fix" a watermark by editing a history file — fix the form field.
- **Fresh-org rebuild** → the provisioning checklist is
  [`docs/bluehq-release-email-endpoint-setup.md`](../../../docs/bluehq-release-email-endpoint-setup.md).

## Known gaps / open items

- **Watermark seeding** — until seeded, a first run covers all history (~55 plugin versions).
  Seed the three fields on the config form before the first real digest.
- **`releaseUrl`** in `assets.local.json` is a placeholder until the full release-notes page
  exists.
- **No per-recipient opt-out** — the footer stays generic ("reply to unsubscribe"); a real
  suppression list + unsubscribe link is a deferred open item.
