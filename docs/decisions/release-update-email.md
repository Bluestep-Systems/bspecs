# ADR: A maintainer-only release-update email, built in the repo and sent from a BlueHQ endpoint

**Status:** Accepted (2026-08-27) — **amended 2026-08-27 by the addendum below** (the send trigger,
credential model, and endpoint lifetime changed; the skill-drafts / platform-sends split, the
no-addresses rule, and the manual-only stance are unchanged)

**Date:** 2026-08-27

**Relates to:** [`feedback-intake-bluehq-endpoint.md`](feedback-intake-bluehq-endpoint.md) (the skill-builds / endpoint-sends pattern this reuses), [`feedback-reporter-email.md`](feedback-reporter-email.md) (the working `B.util.email` send this extends), [`b6p-cli-distribution.md`](b6p-cli-distribution.md) (why `b6p-cli` is a tracked cross-repo dependency, sourced here via `gh`), [`content-sanitization-for-public-tooling.md`](content-sanitization-for-public-tooling.md) (the category-level committed-content rule this ADR follows). Restricted-endpoint / HTTP-auth and fail-closed patterns: [`../../plugin/skills/bluestep-reference/reference/session-cookie-forwarding.md`](../../plugin/skills/bluestep-reference/reference/session-cookie-forwarding.md), [`../../plugin/skills/bluestep-reference/b6p-platform.md`](../../plugin/skills/bluestep-reference/b6p-platform.md), [`../../plugin/skills/bluestep-reference/reference/staff-query-permission-gating.md`](../../plugin/skills/bluestep-reference/reference/staff-query-permission-gating.md).

## Context

We ship the `bluestep-tools` plugin **and** the `b6p` CLI on their own cadences, and users have to notice both. There is no channel today that tells a plugin/CLI user "here's what changed in your workflow, and here's how to update." We want a short, BlueStep-branded email — a brief digest with links out — that keeps both audiences current. The full release detail lives on a separate landing page (designed later); this email is the summary, not the archive.

This is **maintainer ops tooling, not a plugin capability.** The people who install the plugin never run this — only the maintainer cutting a release does. So it must not live in `plugin/`, which is the shipped, user-facing surface that gets generated into `dist/cursor/` and `dist/codex/` and version-bumped on every change. It belongs with the ops apparatus the repo already keeps **outside** `plugin/`: the BlueHQ feedback endpoint, the intake-triage bot (`.github/workflows/triage-intake.yml`), and the repo-local maintainer skill `.claude/skills/bspecs-triage/`.

The content spans two repos: bspecs plugin changes (this repo's `CHANGELOG.md`) and `b6p-cli` changes (a separate repo). A visual design for the email already exists as a design canvas (BlueStep palette + logo, Lato + Merriweather, modeled on the "This week in Claude Code" newsletter). That canvas is the **visual spec, not the sendable artifact** — its flexbox/SVG/webfont markup will not survive real email clients (Outlook especially), so an email-safe HTML version is part of the work.

The feedback intake already solved the hard parts of "an agent-triggered outbound email": a skill drafts content in-session behind an approval gate, then POSTs a payload to a BlueHQ endpoint that does the side-effectful send with secrets held server-side (see [`feedback-intake-bluehq-endpoint.md`](feedback-intake-bluehq-endpoint.md)). This feature reuses that split rather than reinventing it.

## Decision

**A repo-local maintainer skill (`/release-email`, in `.claude/skills/`) builds a finished, email-safe HTML digest across both products and POSTs it to a restricted BlueHQ endpoint that does the per-recipient send.** The skill is manually invoked, gated on in-session approval, and unshipped. Each piece below is a decision with its own reason.

### Repo-local, outside `plugin/`, unshipped

The skill lives in `.claude/skills/release-email/`, the same tier as `.claude/skills/bspecs-triage/`. Because nothing under `plugin/` changes, **none of the plugin machinery applies**: no `dist/` regeneration, no Cursor/Codex variants, no `plugin/.claude-plugin/plugin.json` version bump, `npm run gen:check` stays clean. It is maintainer-only, so shipping it to users would be noise at best and a footgun at worst (it points at a maintainer-auth endpoint).

**Why not a separate repo.** The tool is coupled to *this* repo's `CHANGELOG.md`, its version stream, and its existing ops (the BlueHQ endpoint pattern, the setup-guide convention, the `$CLICKUP_TOKEN`-in-`~/.profile` credential convention). It reads *other* repos' releases with `gh`, which needs no local checkout of them. Splitting it out would buy nothing and add a second repo to keep in sync.

### Skill builds, endpoint sends — the feedback-intake split

The skill renders the **finished HTML** and POSTs it; the BlueHQ endpoint is a **send relay** that stores no template and renders nothing. Server-side secrets (any office token form) stay on the platform exactly as in the intake pattern. This keeps the repo free of send secrets, keeps the recipient list off the repo entirely (see below), and reuses a path already proven in production. The one difference from a *plugin* skill: this one is repo-local, so paths are relative to the repo (no `${CLAUDE_PLUGIN_ROOT}`), and there is no generation step.

### Multi-product sourcing, one email, fail-closed

The digest covers two products from two sources:

- **bspecs plugin** — parsed from the local `CHANGELOG.md` (`## [plugin X.Y.Z]` headers newer than the plugin watermark).
- **`b6p-cli`** — read via `gh` (`gh release list` / `gh api` against `Bluestep-Systems/b6p-cli`, then the changelog bodies at the relevant tags). `gh` is preferred over a raw URL because it works for a **private** repo using the maintainer's existing auth; a public raw-URL fetch is the documented fallback.

The email has **a section per product, each with its own update instruction** (plugin: `/plugin marketplace update`; CLI: the b6p-cli update command). If `gh` is unavailable or unauthenticated, the skill **reports and stops before drafting** — it never sends a plugin-only email that silently drops CLI news. If both product ranges are empty, it stops (natural idempotency). Treating `b6p-cli` as a cross-repo read via `gh` fits the existing tracked-dependency stance in [`b6p-cli-distribution.md`](b6p-cli-distribution.md).

### Per-product watermark on a BlueHQ form field

The "last version emailed" for **each** product lives in a field on the BlueHQ form (working names `lastPluginVersion` / `lastCliVersion`), not in the repo. The endpoint advances each present product's watermark atomically on a successful send. Making the **form server-authoritative** avoids repo/commit split-brain: a run started from a stale local checkout still diffs from the true last-sent point because the skill always re-probes the form first. Each product is diffed independently, so one run can carry plugin-only, CLI-only, or both.

### Restricted Basic-Auth endpoint, credential held locally

Unlike the feedback intake (deliberately anonymous / public-write), this endpoint must **not** be publicly triggerable — an open send endpoint would let anyone email the whole user list. So it is a **restricted** endpoint: **"Request HTTP authentication (Use only for robots)" is ON and `Everyone: Reader` is not granted.** The platform then challenges every caller and returns a clean `401` to anyone unauthenticated; the script never runs for them. This is the documented non-anonymous-endpoint pattern (see the bluestep-reference pages on session-cookie-forwarding / anonymous-access grants).

The maintainer's Basic Auth credential is stored **locally** in `$B6P_RELEASE_EMAIL_AUTH` (holding `user:secret`, matching the repo's `$CLICKUP_TOKEN`-in-`~/.profile` convention), and the skill sends `Authorization: Basic base64($B6P_RELEASE_EMAIL_AUTH)` on **both** the probe and the send. As defense in depth on top of the platform challenge, the script **additionally asserts `B.optUser` is present (fail-closed)** before doing anything — the same fail-closed posture as [`../../plugin/skills/bluestep-reference/reference/staff-query-permission-gating.md`](../../plugin/skills/bluestep-reference/reference/staff-query-permission-gating.md). Prefer a **scoped access token or a dedicated service user** over the maintainer's real account password as the Basic Auth secret, if the platform accepts one — **confirm at setup**. The credential is never logged, echoed in-session, or written to the repo. No secret ships in the repo.

### Sent history in the repo — but never the addresses

Each successful send writes one history file under the skill directory (`sent/<YYYY-MM-DD>-plugin<vA>-cli<vB>.md`) with the ranges, sent-at, subject, recipient **count**, and failure **count**, plus the rendered HTML alongside — for audit and fidelity, not as the range source of truth (the form fields are that).

**Hard rule: no recipient addresses ever land in the public repo.** The recipient list lives **only** in the memo field on the BlueHQ form; the stored HTML keeps the recipient/opt-out line as a **placeholder**, because per-recipient merge happens on the endpoint. Per-address failures are shown in-session for manual follow-up and are **never** persisted to the repo. This follows the category-level committed-content rule of [`content-sanitization-for-public-tooling.md`](content-sanitization-for-public-tooling.md).

### No repo dependencies

Any template-authoring tooling (MJML, juice, a formatter) is installed **locally by the template author only** — nothing goes into `package.json`, no lockfile change, no `node_modules` committed. Only the built HTML template is tracked, and it stays **hand-editable** so a small copy fix never requires the toolchain.

### Email delivery via `B.util.email`

The endpoint sends per recipient with `B.util.email({ to, froms, sender, replyTo, subject, html, text }).bulkPriority(0).send()`, copying the working close-hook call from the feedback intake and extending it:

- **`froms` (required)** — the `From:` header; there is no platform default sender.
- **`sender`** — the `Sender:` header, which **must** be an `@mail.bluestep.net`-hosted mailbox, or the mail is flagged as spam.
- **`replyTo`** — where replies go.
- **`bulkPriority`** — honor the API's bulk rule: existing-relationship recipients only (a curated plugin/CLI user list), sent at bulk priority.

A distinct `From` / `Sender` is exactly what renders the "X on behalf of Y" label in Outlook — achievable, but the "user" side must be a real `@bluestep.net` address. The literal `froms` / `sender` / `replyTo` values are stored on the form as **confirm-at-setup placeholders** until real addresses are pinned.

### Manual trigger only, with an in-session approval gate

The skill is invoked by hand. There is **no** release-event hook, cron, or polling anywhere — matching the repo's event-driven-over-polling and human-gate conventions. On each run the skill shows the drafted subject + rendered body + recipient count and **waits for explicit approval**; a decline sends nothing and writes no history. This mirrors `/bspecs-feedback` and `/spec-execute`.

### Preview before the real send

A send has two phases behind two gates. A `test: true` send goes to a **`testRecipients`** field on the config form — the maintainer's own validation inboxes — and does not advance the watermark; the maintainer opens that email and validates the *real* rendering (Outlook + Gmail). Only then, as a separate gate, does the `test: false` send go to the real `recipients` and advance the watermark. The test audience is a **form field, not a hardcoded address**, so it changes in the UI with no code push; a `test` send with an empty `testRecipients` errors rather than falling back to the real list. Because the credential is human-run (see the endpoint decision), both phases are commands the maintainer executes — the agent builds the payload and hands them over.

### Credential never enters an agent session

The Basic Auth credential lives in a gitignored `.env` the skill reads, and — a hard rule — the **agent never reads that file or runs the authenticated probe/send**. It generates the commands + a secret-free `payload.json`; the human runs them in their own shell. HTTP Basic Auth is reversible base64 (not a hash), so any agent-run authenticated call would put the real secret in the session's blast radius; keeping those calls human-run is the only thing that removes that risk. Prefer a scoped token / dedicated service account over a personal password so a slip is contained and revocable.

## Options considered

### A. Repo-local maintainer skill + restricted BlueHQ send endpoint (chosen)

Reuses a proven split (skill builds, endpoint sends, secrets server-side), keeps send secrets and the recipient list off the repo, and sits with the existing ops apparatus so no plugin machinery fires. Cost: one more platform endpoint to provision and a maintainer credential to manage. Chosen because it is the smallest thing that keeps both audiences informed while holding the security line (no address list in a public repo, no publicly triggerable send).

### B. A separate repo for the newsletter tooling — rejected

The tool is coupled to this repo's changelog, version stream, and ops conventions, and it reads other repos via `gh` without needing their checkouts. A second repo adds sync burden and buys nothing.

### C. Ship it as a plugin skill — rejected

It is maintainer-only and points at a maintainer-auth endpoint. Shipping it would generate Cursor/Codex variants, force a version bump on every edit, and hand users a tool they can't use. It belongs outside `plugin/`.

### D. Automatic send on release / cron / polling — rejected (out of scope)

The maintainer must choose when a digest goes out and approve the copy first; nothing outward-facing should go without sign-off. Explicitly excluded per the repo's event-driven-over-polling + human-gate stance.

### E. Anonymous send endpoint like the feedback intake — rejected

The feedback endpoint is intentionally public-write because it only *files* triaged items. A send endpoint that emails the whole user list must not be publicly triggerable — hence the restricted "Request HTTP authentication" path with no `Everyone: Reader` grant and a fail-closed `B.optUser` assertion.

## Consequences

- **A restricted BlueHQ endpoint must be provisioned** (BsJs send relay, "Request HTTP authentication" ON, no `Everyone: Reader`, access granted only to the maintainer or a service user), pushed with `b6p push` from a gitignored `platform/U*/` working copy — the endpoint source is **not** committed, same as the feedback intake. Setup lives in `docs/bluehq-release-email-endpoint-setup.md`.
- **Deliverability needs a real test.** SPF/DKIM/DMARC alignment, the "user on behalf of bluestep.net" label, and whether the setters accept `"Display Name <addr>"` format all need a **test-mode send** viewed in Outlook (Word engine) + Gmail before go-live. Test mode routes every send to one maintainer address and does **not** advance watermarks.
- **`gh` is a hard dependency for the CLI half.** No `gh` (or unauthenticated) → the skill stops before drafting rather than silently omitting CLI news. Documented; public raw-URL fetch is the fallback.
- **Credential hygiene is on the maintainer.** Basic Auth is base64, not encryption — safe only over HTTPS (the endpoint is `https://…bluestep.net`). The credential lives in `~/.profile` as `$B6P_RELEASE_EMAIL_AUTH`, is never logged/echoed/committed, and should be a scoped token or service user rather than a real password where possible.
- **Format couplings to document.** The plugin parser depends on the `## [plugin X.Y.Z]` changelog header shape; the CLI path depends on the `gh` release shape. Both are noted so a format change is a known breakage point.
- **No `CHANGELOG.md` entry, no version bump, no `dist/` regen.** Nothing under `plugin/` changes; the changelog is a *content source* here, not something this feature edits. This ADR plus the setup guide are the discoverability record.
- **Confirm-at-setup open items:** the org U-number and form/field/record-type names; the literal `froms` / `sender` / `replyTo` addresses; the recipient memo delimiter; the logo PNG hosting URL (a public BlueHQ file, referenced absolutely by the email); and the opt-out mechanism (manual memo removal vs. an unsubscribe link that posts back to suppress an address). These are carried as clearly-marked placeholders until pinned.

## References

- [`feedback-intake-bluehq-endpoint.md`](feedback-intake-bluehq-endpoint.md) — the skill-builds / endpoint-sends split and the `B.util.email` send this reuses and extends.
- [`feedback-reporter-email.md`](feedback-reporter-email.md) — the working close-hook `B.util.email` call copied here.
- [`b6p-cli-distribution.md`](b6p-cli-distribution.md) — `b6p-cli` as a tracked cross-repo dependency (sourced via `gh`).
- [`content-sanitization-for-public-tooling.md`](content-sanitization-for-public-tooling.md) — the category-level committed-content rule (no addresses in the repo).
- [`../../plugin/skills/bluestep-reference/reference/session-cookie-forwarding.md`](../../plugin/skills/bluestep-reference/reference/session-cookie-forwarding.md), [`../../plugin/skills/bluestep-reference/b6p-platform.md`](../../plugin/skills/bluestep-reference/b6p-platform.md) — restricted-endpoint / HTTP-auth grant pattern.
- [`../../plugin/skills/bluestep-reference/reference/staff-query-permission-gating.md`](../../plugin/skills/bluestep-reference/reference/staff-query-permission-gating.md) — the fail-closed `B.optUser` posture.
- [`../../.claude/specs/release-update-email/`](../../.claude/specs/release-update-email/) — requirements, design, tasks for this change.
- [`../bluehq-release-email-endpoint-setup.md`](../bluehq-release-email-endpoint-setup.md) — the one-time human setup guide (form + fields, token form, access config, from/sender, test-mode send). *(Authored in a later task.)*

---

## Addendum (2026-08-27): the outbox rebuild — signed form entry + post-save send, endpoint retired

Implemented by spec [`release-email-outbox`](../../.claude/specs/release-email-outbox/). The
original decision's *shape* survives — the skill drafts and renders, the platform does the
side-effectful send, no recipient address ever enters the repo or a session — but the trigger,
the transport, and the credential model were rebuilt, and the endpoint is gone.

### What changed and why

**Each release email is now an entry on a multi-entry "outbox" form** (same record type as the
config form): subject, the finished email HTML, plain-text alternative, a payload-JSON blob with
the version ranges, a test-send request checkbox, an approval **Signature** field, and
post-save-written result fields (`testSentAt`, `sentAt`, `sendResult`). A merge report embedded on
the entry renders the stored HTML in a sandboxed `<iframe srcdoc>` so approval happens against the
exact artifact. Every send has a durable, previewable, attributable platform record.

**The real send is a post-save formula, fired by signing.** A POST_SAVE formula on the outbox form
(its Primary Form) applies a decision ladder on every UI save: already-sent → no-op forever;
signed → real send to the config form's `recipients`, advance the watermark(s) for the products in
the payload, stamp `sentAt` + a counts-only `sendResult`; test-requested → send to
`testRecipients`, stamp `testSentAt`, clear the flag; otherwise no-op. The send is native
`B.util.email` — no HTTP hop, no stored credential anywhere.

**The gateway MCP replaced the endpoint.** The skill now reads the watermarks and creates/updates
outbox entries over the bundled gateway MCP (`form_entry`), approval-gated in-session. With
nothing left for the endpoint to do (probe → MCP read; queue → MCP create; test send → the
checkbox; real send → the signature), the restricted endpoint, its Basic Auth credential, the
gitignored `.env`, and every human-run `curl` were retired. The superseded sections above
("Restricted Basic-Auth endpoint", "Credential never enters an agent session", the probe/`test:
true` contract) describe the retired path.

**The digest gained a third product: gateway-MCP changes.** MCP changes ship server-side with no
version stream, so their source is ClickUp — closed tasks tagged `mcp` in the tooling space, read
via the REST API (`$CLICKUP_TOKEN`), watermarked by a new `lastMcpSent` timestamp field on the
config form (`toVersions.mcp` = the max `date_closed` among included tasks). CLI notes stay on
GitHub releases.

### The new security boundary

The old boundary (agent never reads `.env` / never runs the authenticated call) died with the
endpoint. Its replacements are hard rules on the MCP path:

- **The agent never reads the `recipients` or `testRecipients` fields** through any read path.
  Watermarks and sender identity are fine to read; the audience is not.
- **The agent never writes the signature field.** The platform also refuses `form_entry` signature
  writes (verified: boolean → "Get/set type not supported", string → "not in the required
  format"), but the skill forbids the attempt regardless.
- **Blast radius by construction:** with the endpoint gone, nothing agent-callable can reach the
  real list. MCP `form_entry` writes do not fire save formulas (verified live), so even a
  test send requires a human UI save. The only path to the real audience is a human signature.

### "Signed = armed" (learned the hard way)

Any UI save of a **signed, not-yet-sent** entry performs the real send — not just the save that
adds the signature. During the build this fired live: a signature made against the earlier
logging-stub version of the formula was still on the scratch entry when the real send logic
deployed, and the next save sent the raw template to the (fortunately maintainer-only) recipient
list and advanced the watermarks with scratch values (both restored). Rules that follow: never
deploy send-logic changes while any entry is signed-and-unsent, and the skill's queue step warns
when a signed-unsent entry exists. The `sentAt` guard held everywhere else: sent entries are
inert on every later save.

### Platform findings the implementation depends on (all verified live 2026-08-27)

- **`form_entry` round-trips HTML byte-faithfully** (13.8KB template: MSO conditionals, entities,
  comments, trailing newline intact) — it is the queue transport.
- **UI saves mangle editable HTML memos** (the WYSIWYG rewrites them — `<mce:noscript>`
  artifacts, collapsed whitespace). Fix: `emailHtml` and `payloadJson` are
  `fieldControlType: HIDDEN_DEFAULT` — hidden fields render no editor, so UI saves can't touch
  them; verified byte-intact across UI saves. The merge-report preview is the human's view.
- **`form_entry` READ crashes server-side if a SIGNATURE fieldId is included** (Gson
  serialization error) — reads must always exclude signature fields.
- **A multi-entry form wired as a current-record `add_forms` dependency is a silent no-op
  (`formsAdded: 0`) unless it is the script's Primary Form.** The post-save had it as Primary
  Form from `create_script`; the merge report needed the UI-only Primary Form assignment first
  (`update_script primaryFormId` is FORMULA-only).
- **No merge-report field type exists in the MCP `field` tools** — embedding the preview on the
  form is a UI hand-back.

### Consequences (delta)

- Platform inventory: the outbox form, the post-save formula, and the preview merge report exist
  on the org (gitignored `platform/U*/` working copies; ids in run notes, not here). The endpoint
  component and its working copy are deleted; `.env` / `.env.example` are gone from the skill.
- The skill's preconditions are now `gh`, `$CLICKUP_TOKEN`, and the gateway MCP — no send
  credential at all.
- The recipient-count display died with the probe (no address-free way to count over MCP); the
  post-send `sendResult` records the actual sent count.
- Setup/provisioning moved to the reworked
  [`../bluehq-release-email-endpoint-setup.md`](../bluehq-release-email-endpoint-setup.md).
