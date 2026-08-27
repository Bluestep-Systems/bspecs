# BlueHQ release-update email — platform setup (outbox era)

**Status:** Provisioned and verified live 2026-08-27 (spec `release-email-outbox`). This doc is
the re-runnable checklist for standing the pieces up on a fresh org, plus the record of what
exists and how the pieces talk. The original endpoint-era version of this file described a
restricted send endpoint + Basic Auth credential; that path is **retired** — see the 2026-08-27
addendum in [`decisions/release-update-email.md`](decisions/release-update-email.md).

The send path today: the repo-local `/release-email` skill drafts the digest and **queues it as an
entry on an outbox form over the gateway MCP**; a **post-save formula** on that form does the test
send (checkbox) and the real send (**signature**), reading the audience from the config form. No
endpoint, no send credential anywhere.

> **This file is committed to a public repo.** It stays **category-level** per
> [`decisions/content-sanitization-for-public-tooling.md`](decisions/content-sanitization-for-public-tooling.md):
> no org U-number, no form/field/script topIds, no addresses, no admin deep-links. Ids live in the
> maintainer's run notes and the gitignored `platform/U*/` working copies.

---

## 0. The inventory

Four platform objects on the org that owns the flow, all on the same Office record type:

| # | Object | Kind | Job |
| --- | --- | --- | --- |
| 1 | Release-email **config form** | Single-entry form | Audience (`recipients`, `testRecipients`), sender identity (`froms`, `sender`, `replyTo`), three watermarks (`lastPluginVersion`, `lastCliVersion`, `lastMcpSent`) |
| 2 | Release-email **outbox form** | Multi-entry form | One entry per email: content, test-request checkbox, approval signature, result stamps |
| 3 | **Post-save formula** on the outbox form | BSJS Formula (POST_SAVE) | The decision ladder: test send / real send / guards / watermark advance |
| 4 | **Preview merge report** | BSJS MergeReport | Renders the entry's stored HTML in a sandboxed iframe, embedded on the outbox form |

Everything except two UI-only steps (noted below) is provisioned over the gateway MCP per
[`decisions/platform-mcp-integration.md`](decisions/platform-mcp-integration.md) and the
`bluestep-reference` `mcp-platform-authoring` procedure (echo + approval on every mutation).

---

## 1. Config form (single-entry)

Unchanged from the original setup except for one added field.

- [ ] Memo fields **`recipients`** and **`testRecipients`** — the real and preview audiences.
      Parsed tolerantly (`;`, commas, or newlines). **Hard rule:** these addresses live only here —
      never in the repo, never in an agent session, never on an outbox entry.
- [ ] Text fields **`froms`** (required From header), **`sender`** (MUST be an
      `@mail.bluestep.net`-hosted mailbox or mail is spam-flagged), **`replyTo`**.
- [ ] Watermark Text fields **`lastPluginVersion`**, **`lastCliVersion`**, and **`lastMcpSent`**
      (ISO-8601 timestamp — the newest ClickUp `mcp`-tagged close included in the last digest).
      Seed before the first real send (empty = first run covers everything). The post-save carries
      writable field access to all three.

## 2. Outbox form (multi-entry)

- [ ] Create a **multi-entry** form on the same record type as the config form (mirror the config
      form's permission set: staff editors only, no public access). Verify the entry mode with
      `list_available_forms` — the create-echo boolean is not authoritative.
- [ ] Fields (formulaIds): `subject` (Text, required), `emailHtml` (Memo/HTML), `emailText`
      (Memo), `payloadJson` (Memo/JSON), `testSendRequested` (Boolean checkbox),
      `approvalSignature` (Signature SIMPLE — **set the Right Label at creation** or it renders
      blank), `testSentAt` (Text), `sentAt` (Text), `sendResult` (Memo).
- [ ] **Set `emailHtml` and `payloadJson` to `fieldControlType: HIDDEN_DEFAULT`.** Load-bearing:
      an editable HTML memo is re-submitted through the WYSIWYG on every human UI save, which
      mangles the stored email (collapsed whitespace, `<mce:noscript>` artifacts). Hidden fields
      render no editor, so UI saves leave them byte-intact (verified). The merge-report preview is
      the human-facing view.

## 3. Post-save formula ("send")

- [ ] `create_script` a FORMULA with `formulaType: POST_SAVE`, the org's unit, the Office record
      type, and **`primaryFormId` = the outbox form** (the Primary Form is what makes a save
      formula fire at all — and what lets `add_forms` accept a multi-entry form as a
      current-record dependency; without it that call is a silent no-op, `formsAdded: 0`).
- [ ] Wire dependencies: the office query as a query group; the config form into that group
      (writable); the outbox form as a current-record form (writable). Field access: read the
      audience/sender/content/signature fields; write the three watermarks and the four
      result/flag fields. Read the declarations back and confirm the accessor names.
- [ ] Author the script in a `b6p`-pulled working copy (`platform/U*/…`), push with `--snapshot`.
      The logic is the decision ladder (top match wins):
      1. `sentAt` non-empty → no-op, forever.
      2. Signature signed → **real send** to `recipients`, advance the watermark(s) for the
         products present in `payloadJson.toVersions` (`plugin`/`cli` → version fields, `mcp` →
         `lastMcpSent`), stamp `sentAt` + a **counts-and-reasons-only** `sendResult`. Fail closed
         (refuse, stamp nothing) on missing/invalid payload versions, empty `froms`, or empty
         `recipients` — a refused entry stays sendable after the fix.
      3. `testSendRequested` → **test send** to `testRecipients`, stamp `testSentAt`, clear the
         flag; refuse (and clear the flag) if `testRecipients` is empty. Watermarks never move.
      4. Otherwise no-op.
- [ ] Know the trigger semantics (all verified live): **UI saves fire the formula — including the
      signature save; MCP `form_entry` writes do NOT** (they bypass the save pipeline). So the
      agent can queue and edit entries but can never trigger a send; even the test send needs a
      human Save. And **"signed = armed": any later UI save of a signed, unsent entry sends** —
      never leave an entry signed-and-unsent, and never deploy send-logic changes while one exists.

## 4. Preview merge report

- [ ] `create_script` a MERGE_REPORT; then — **UI step** — open its setup page and assign the
      outbox form as its **Primary Form** (not settable over MCP for merge reports; required both
      for the current-record wiring and for the embedding field to resolve).
- [ ] Wire the outbox form as a current-record dependency (read access: subject, emailHtml,
      testSentAt, sentAt) after the Primary Form is assigned.
- [ ] The script renders the stored `emailHtml` inside `<iframe srcdoc="…" sandbox="">` (the
      stored value is a complete email document — the iframe keeps its CSS out of the platform
      chrome), with a status line (sent / test-sent / not sent) and an empty-HTML warning. Push
      `--snapshot` from the working copy.
- [ ] **UI step** — in the outbox form's design page, add a **Merge Report** element embedding the
      report (no merge-report field type exists in the MCP field tools), placed above the
      test-send checkbox and signature.

## 5. Verify

- [ ] **Fidelity:** `form_entry` CREATE a scratch entry carrying a real rendered digest, read it
      back, byte-compare (MSO conditionals, entities, comments, trailing newline). Then have a
      human UI-save the entry and re-read — still byte-identical (the hidden-field rule at work).
      Never include the signature fieldId in a `form_entry` READ — it crashes server-side.
- [ ] **Test path:** tick the checkbox + Save → mail to `testRecipients`, `testSentAt` stamped,
      flag cleared, watermarks untouched. Repeat with `testRecipients` emptied → no mail, refusal
      in `sendResult`, flag cleared.
- [ ] **Real path (canary):** point `recipients` at maintainer-only addresses, note the
      watermarks, sign + Save → mail arrives, watermarks advance, `sentAt` + attribution in
      `sendResult`; a later no-change Save is a no-op. Restore `recipients` and the watermarks.
- [ ] **Boundary:** a `form_entry` write to the signature field is refused by the platform
      (verified: unsupported boolean type / string format rejection) — and is forbidden to the
      agent regardless.

## 6. Endpoint retirement (one-time, done)

The endpoint-era pieces to remove when rebuilding an org the old way was set up on:

- [ ] Delete the send-relay endpoint component on the platform (UI).
- [ ] Delete its gitignored `platform/U*/…` working copy locally.
- [ ] Delete the skill-side `.env` (the Basic Auth credential + endpoint URL) — nothing reads it
      anymore; revoke the credential if it was a scoped token.
- [ ] Confirm the old `/b/` URL no longer answers.

---

## Notes for future maintainers

- **The addresses live in exactly one place** — the config form's memo fields. The agent-side
  hard rule is now *reads*: no MCP/GraphQL read of `recipients`/`testRecipients`, ever. If an
  address shows up in a diff, a session, or an outbox entry, stop and scrub.
- **The signature is the only path to the real audience.** Nothing agent-callable sends: MCP
  writes don't fire save formulas, and the send logic lives only in the post-save. Keep it that
  way — do not add an endpoint "for convenience".
- **Deliverability is unchanged and still fragile:** `sender` must stay an
  `@mail.bluestep.net`-hosted mailbox; `froms`/`sender` changes are a test-send-and-eyeball
  change (Outlook + Gmail), not a fire-and-forget edit.
- **Watermarks are still server-authoritative.** Fix them on the config form (over MCP or in the
  UI), never by editing repo history files. A refused real send stamps nothing, so the entry
  stays sendable once the config is fixed.

## See also

- [`decisions/release-update-email.md`](decisions/release-update-email.md) — the governing ADR +
  the 2026-08-27 outbox addendum (trigger, boundary, retirement, and the verified platform
  findings this checklist encodes).
- [`decisions/platform-mcp-integration.md`](decisions/platform-mcp-integration.md) — the gateway
  MCP the skill and this provisioning ride on.
- `.claude/skills/release-email/SKILL.md` — the maintainer skill (drafting flow, gates, hard
  rules).
- Spec: `.claude/specs/release-email-outbox/` (requirements / design / tasks), which superseded
  `.claude/specs/release-update-email/` for the send path.
