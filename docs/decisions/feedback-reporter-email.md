# ADR: Close-out notifications email the feedback reporter, worded by a resolution field

**Status:** Accepted (2026-07-23). Amends [`feedback-intake-bluehq-endpoint.md`](feedback-intake-bluehq-endpoint.md) (reporter identity: optional → **required**). Amended 2026-07-31: multi-reporter support + email-silent `duplicate` closes (see the amendment section at the end).

**Date:** 2026-07-23

**Relates to:** [`feedback-intake-bluehq-endpoint.md`](feedback-intake-bluehq-endpoint.md) (the intake this extends), [`content-sanitization-for-public-tooling.md`](content-sanitization-for-public-tooling.md) (the committed-content rule this ADR follows).

## Context

Feedback filed via `/bspecs-feedback` is born as a ClickUp task on AI.List (`901414350506`). The submitter is deliberately not a ClickUp member, so when their item was eventually closed they heard **nothing** — the loop never closed. The only handle on the submitter is the `reporter` custom field (name + email captured at filing time).

A plain "your item was closed" email would mislead: on AI.List, *Closed* can mean shipped, fixed-but-unreleased, won't-fix, duplicate, or stale. The close event is the right trigger (it always happens), but it carries no meaning by itself.

## Decision

**When an AI.List task transitions to Closed, a BlueHQ endpoint emails the reporter — with wording driven by a `resolution` dropdown that gates the send (no resolution → no email, only a nudge comment), and a body chosen by a three-tier ladder.** "Required" here is enforced by the endpoint, not by ClickUp — Required Custom Fields turned out to be plan-gated (see below).

- **Trigger:** a ClickUp webhook (`taskStatusUpdated`, list-scoped) POSTs to the *existing* intake endpoint at `?hook=close` — one component, two doors (components cannot share code, so a second component would duplicate the credential plumbing). Deliveries are HMAC-verified (`X-Signature`, secret in the same top-level-office token form as the other credentials). Event-driven; no polling.
- **Semantics via `resolution`:** a new dropdown custom field (`shipped` / `fixed-unreleased` / `wont-fix` / `duplicate` / `stale`) set by whoever closes. **All outcomes** get a (differently-worded) email — even a "no" tells the reporter they were heard. Empty `resolution` → **no email**; the endpoint posts a nudge comment instead ("set `resolution` and re-close to send"). Required Custom Fields turned out to be plan-gated (Business+) and unavailable, so the nudge backstop is the *only* enforcement — anticipated and acceptable.
- **Body ladder:** (1) a `resolution-note` text-area custom field — a reporter-facing paragraph sent **verbatim** when present; (2) else a **`B.ai` draft** from the task title/description/resolution/comments — tenant default provider, no `apiKey` (system usage tracking), spend-capped per flag, system prompt constrained to plain, category-level, reporter-facing language; (3) else fixed per-resolution generic wording. An email always goes out once the gates pass — the ladder only picks the body. `resolution-note` is deliberately **never required**: a forced text field yields junk that would land verbatim in an inbox, worse than the AI/generic tiers.
- **Visibility + dedupe in one artifact:** after sending, the endpoint posts a sent-marker comment on the task **quoting the exact email body**. It is the dedupe key (re-close sends nothing) and the after-the-fact review surface — a closer who skipped the note immediately sees what went out.
- **Reporter email becomes required at intake** (the amendment): the skill's confirm gate is editable but not skippable, and the endpoint rejects payloads with a missing/implausible email. Anonymous filing ends deliberately — the loop-closing promise is worthless without an address, and `git config` auto-fill makes the requirement near-zero friction. Pre-change tasks with no reporter email are skipped silently at close.
- **Test mode:** `?hook=close&mode=test`, gated by the webhook secret in an `X-Test-Key` header. Runs the full real pipeline on any existing list item (gates skipped) but mails **only the maintainer's hardcoded test address**, prefixes `[TEST]`, performs **no ClickUp writes**, and echoes tier/body/usage in the response. `{"ping":"ai"}` is a minimal `B.ai` end-to-end diagnostic.

## Options considered

- **GitHub-issue close as the trigger** — rejected: the ClickUp task is the system of record (the issue is a derived artifact), and issue-close has the same shipped-vs-wontfix ambiguity plus extra moving parts.
- **Notify on release only** — rejected: most accurate "applied" signal but the task→release mapping is manual, and negative outcomes would never notify.
- **A "received" acknowledgment email at filing time** — rejected: the intake endpoint is public and unauthenticated, and the reporter email is request data, so auto-send-on-intake is a spam/phishing vector by construction; the in-session confirmation already covers "we got it". The close email is safe because a human gates it (triage + close with a resolution).
- **Mid-work "update" emails on comments** — rejected: comments are internal dev notes; forwarding them leaks internals and spams.
- **A personal AI-provider API key for the draft** — rejected: one more secret, bypasses the platform usage gate (no metering), ties infrastructure to an individual account. Native `B.ai` on the tenant default needs none of that.
- **Human approval of the AI draft before sending** — rejected: reporters are internal staff, the prompt is constrained, the quoting marker gives after-the-fact review, and an approval gate re-adds the manual step the automation exists to remove.

## Consequences

- **Platform-API findings** (verified live, 2026-07-23): the typed outbound-mail surface is `B.util.email` (the `B.email` doc examples are sugar the endpoint's `B` doesn't expose); the platform has **no default sender**, so `froms` is required (a no-reply address, `replyTo` the maintainer); `B.ai` works end-to-end on the tenant default (~1k tokens per drafted note); the `Version` custom field records the version feedback was *filed from*, not the ship version — deliberately excluded from the email.
- **`B.ai` is experimental** and the feature tolerates its total failure: the ladder floors at generic wording, so notification delivery never depends on the AI tier.
- **Every terminal webhook outcome returns 200** (including skips and the unconfigured-secret state) so ClickUp's failing-delivery auto-disable never trips on expected no-ops.
- **The endpoint remains platform-resident** (no committed in-repo copy), per the intake ADR; source is edited via a gitignored `b6p`-pulled working copy and shipped with publish snapshots.
- **Two release mechanics, as usual:** the skill change ships on the plugin **0.14.0** version bump; this ADR and the setup-doc extension ship on merge to `main`; the endpoint itself shipped via `b6p push --snapshot` (three snapshots, 2026-07-23) independent of both.

## Amendment (2026-07-31): multiple reporters per task, and `duplicate` closes go email-silent

Dedup surfaced the gap: consolidating a duplicate report into a surviving task either lost the
duplicate's reporter from the loop (a ClickUp merge deletes the source task — no close event, no
email, ever) or sent them a "this was consolidated" interim email that is not the resolution they
need (the resolution is the "update your plugin now" signal). Two changes, both in the close hook:

- **The `reporter` field is now a `;`-separated list** of `Name <email>` values. Intake still
  writes exactly one; extra reporters are appended manually during dedup consolidation. On a real
  close, the endpoint sends **one email per reporter**, each with its own greeting — same body from
  the existing ladder. The sent-marker comment lists every address actually reached; a partial send
  failure is surfaced (`ok:false` + `warning`) without blocking the other recipients, and re-close
  does not retry failed recipients (the marker stays the dedupe key). A single-value field behaves
  exactly as before.
- **`resolution = duplicate` sends no email.** The endpoint posts a once-only carry-over marker
  comment (`🔇 Duplicate close — no email sent`, third distinct prefix) instead. The dedup
  procedure is: copy the duplicate's unique content onto the survivor (comment), link the tasks,
  **append the duplicate's reporter to the survivor's `reporter` field**, then close the duplicate
  as `duplicate`. Everyone on the survivor's field gets the real resolution email when it ships.
  The `duplicate` wording tiers stay in the code (test mode can still exercise them) but are
  unreachable on the live path.

Rejected alternative: emailing dupe reporters "tracked elsewhere, follow the link" at
consolidation time — an actionless interim notification; the reporter only needs the final
outcome, which the multi-reporter field now guarantees they get.

## References

- [`feedback-intake-bluehq-endpoint.md`](feedback-intake-bluehq-endpoint.md) — the intake ADR this amends.
- [`../bluehq-feedback-endpoint-setup.md`](../bluehq-feedback-endpoint-setup.md) — setup checklist (custom fields, webhook registration, secret form field, test mode).
- Spec: `.claude/specs/feedback-reporter-email/` (local working docs, gitignored).
- Live verification 2026-07-23: `B.ai` ping OK; AI-tier and note-tier test emails approved by two recipients; full production loop (webhook → HMAC → gates → email → quoting marker comment) confirmed on a real closed item.
