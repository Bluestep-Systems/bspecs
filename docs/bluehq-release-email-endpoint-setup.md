# BlueHQ release-update email endpoint — one-time setup

**Status:** Not yet stood up — this is the fresh-run checklist to provision the path for the first
time. It doubles as the **field-name + payload contract** the BsJs endpoint (spec task 4) and the
`/release-email` skill (spec task 5) both code against, so the names here are load-bearing: pick
them once, here, and use the same spellings on both sides.

A runnable, category-level checklist for standing up the `/release-email` send path: the
**restricted BlueHQ endpoint** the skill POSTs to, the config form + token form it reads at runtime,
the access/auth setup that keeps it non-public, the hosted logo the email links to, and the deploy +
verify that finishes the job. This covers spec `release-update-email` — the platform/admin
provisioning plus the deploy/verify half of tasks **4–5**.

Read the governing ADR — [`decisions/release-update-email.md`](decisions/release-update-email.md) —
for *why* the skill builds the content and a BlueHQ endpoint does the send, and why this endpoint is
**restricted** (unlike the deliberately public feedback intake). This doc is the *how*.

> **This file is committed to a public repo.** It stays **category-level** per
> [`decisions/content-sanitization-for-public-tooling.md`](decisions/content-sanitization-for-public-tooling.md):
> **no secrets or tokens**, **no recipient or employee email addresses**, **no org subdomain**, **no
> internal admin deep-links**. The org U-number, the form/field/record-type identifiers, and the
> literal `froms` / `sender` / `replyTo` addresses appear here only as clearly-marked placeholders
> (`U<org>`, `<...>`) — fill in the real values in your own run notes, never in this file. The hard
> rule from the ADR holds: **no recipient address ever lands in the repo** — the list lives only in
> the memo field on the config form.

> **How to read the checkboxes.** Every `[ ]` is a step an admin ticks as they go. Where the spec did
> not pin an exact UI path or value, the step says **"confirm during setup"** — record the real value
> in your own run notes, do not guess it here.

---

## 0. Prerequisites & order

The platform work is the **critical path** — the endpoint is useless until the config form exists and
the access setup is in place. Do them in this order; sections 1 and 2 are independent and can run in
parallel, but section 3 (access/auth) and section 5 (deploy) need the endpoint pushed, and section 6
(the contract) is the reference both code halves share.

| # | Step | Owner | Blocks |
| --- | --- | --- | --- |
| 1 | Create the BlueHQ **config form** (recipients + sender + watermark fields) | BlueHQ admin | 4, 5, 6 |
| 2 | Create the BlueHQ **token form** (only if a server-side secret is needed) | BlueHQ admin | 5 |
| 3 | Configure **access / HTTP auth** on the endpoint + store the local credential | BlueHQ admin + maintainer | 5, 6, 7 |
| 4 | Host the **logo PNG** at a public BlueHQ file URL | BlueHQ admin | 5 (email template) |
| 5 | **Push** the BsJs endpoint with `b6p push` | Maintainer | 6, 7 |
| 6 | Agree the **payload/response contract** (reference — no action) | — | 7 |
| 7 | **Verify** (probe, test-mode send, 401 check) | Maintainer | — |

---

## 1. Create the BlueHQ config form

The endpoint reads its whole runtime configuration — who gets the email, the sender identity, and the
per-product watermark — from a **single-entry form** in BlueHQ. Keeping it on a form means the
maintainer curates the recipient list and pins the sender addresses **without a code change**, and
the recipient list never leaves the platform.

- [ ] In the **BlueHQ Admin UI**, create a **single-entry form** on the org that owns the endpoint
      (org `U<org>` — **confirm during setup**; keep the U-number and the internal admin deep-link out
      of this public file). Record the form's **read path** (the field identifiers / lookup the
      endpoint uses server-side) in your run notes.

### 1a. Recipient lists — two memo fields

- [ ] **`recipients`** — type **Memo / Text Area** (multi-line). The **real** audience — every
      recipient address for a live send.
- [ ] **`testRecipients`** — type **Memo / Text Area** (multi-line). The **preview** audience: a
      `test:true` send goes here (the maintainer's own validation inboxes) and **never** to
      `recipients`. Required for a preview send — the endpoint errors if it's empty rather than
      falling back to the real list.
  - **Delimiter:** both memos are parsed **tolerantly** — the endpoint splits on `;`, commas, **or
    newlines**, trims each entry, and drops blanks. So one-per-line (the natural memo shape) and
    `;`-separated both work.
  - **Hard rule:** these addresses live **only** here — never returned by the probe (it returns
    `recipientCount` / `testRecipientCount`, counts only), never written to the repo, never echoed
    in-session.

### 1b. Sender identity — three Text fields

Carry the literal addresses as **confirm-at-setup placeholders** until real ones are pinned. All three
are **Text** fields.

- [ ] **`froms`** — the `From:` header. **Required** — the platform has no default sender, so a send
      with no `froms` fails. Placeholder: `<display name> <from-addr@bluestep.net>` — **confirm during
      setup**.
- [ ] **`sender`** — the `Sender:` header. **MUST be an `@mail.bluestep.net`-hosted mailbox**, or the
      mail is flagged as spam. Placeholder: `<sender-addr@mail.bluestep.net>` — **confirm during
      setup**.
- [ ] **`replyTo`** — where replies go (typically the maintainer). Placeholder:
      `<reply-addr@bluestep.net>` — **confirm during setup**.

> **Why two of them.** A **distinct `froms` and `sender`** is exactly what renders Outlook's
> "*X* on behalf of *Y*" label — the `froms` side is the human-facing "X" and must be a real
> `@bluestep.net` address; the `sender` side is the "Y" and must be the `@mail.bluestep.net`-hosted
> mailbox. Two things need a **test-mode send** to confirm (section 7): whether the setters accept a
> `"Display Name <addr>"` string, and which way round Outlook renders the label.

### 1c. Per-product watermark — two Text fields

The "last version emailed" for **each** product is **server-authoritative** and advanced by the
endpoint on a successful send, so a run started from a stale local checkout still diffs from the true
last-sent point (the skill always re-probes first).

- [ ] **`lastPluginVersion`** — type **Text**. The last bspecs plugin version emailed. Initial value:
      **empty** (first run then covers all plugin changelog entries) **or** a floor version like
      `0.0.0` — **confirm during setup**.
- [ ] **`lastCliVersion`** — type **Text**. The last `b6p-cli` version emailed. Same initial-value
      choice — empty or a floor — **confirm during setup**.

> The endpoint advances **only** the watermark(s) for products present in the send payload: a
> plugin-only send bumps `lastPluginVersion` and leaves `lastCliVersion` untouched, and vice versa.

---

## 2. Create the BlueHQ token form (only if a server-side secret is needed)

The send itself uses `B.util.email`, which needs **no** API key, and `B.ai` (if the skill ever asks
the endpoint to draft) runs on the tenant default with **no** key either. So unlike the feedback
intake, **this endpoint may need no token form at all.** Create one only if a later addition needs a
server-side secret (e.g. an opt-out suppression call to some API).

- [ ] *(Only if needed)* Create a **single-entry token form on the top-level office**, exactly as the
      feedback intake does — see section 3 of
      [`bluehq-feedback-endpoint-setup.md`](bluehq-feedback-endpoint-setup.md). Use **readable** field
      types (**Text / Memo**, never a Secret/password field — a Secret field is one-way and the
      endpoint could not read the value back), and lock the form down with **view permissions** and/or
      a `HIDDEN_DEFAULT` control rather than by hashing. Record the read path in your run notes; keep
      it out of this public file.

> If nothing server-side is secret, skip this section — the Basic Auth credential in section 3 is a
> **local** maintainer secret, not a server-side one, and does not go in a token form.

---

## 3. Access / auth configuration (the security-relevant part)

This endpoint emails the **whole user list**, so it must **not** be publicly triggerable. Unlike the
feedback intake (intentionally anonymous / public-write), this one is **restricted**: the platform
challenges every caller, so an unauthenticated request gets a clean `401` and the script never runs
for them.

### 3a. Restrict the endpoint on the platform

- [ ] **Do NOT grant `Everyone: Reader`** on the endpoint. Grant access **only** to the maintainer's
      BlueStep user, or to a **dedicated service user** created for this purpose. Least privilege — the
      fewer identities that can trigger a send, the better.
- [ ] Enable **"Request HTTP authentication (Use only for robots)"** on the endpoint. With this on and
      no `Everyone: Reader`, an unauthenticated caller receives a clean **`401`** (a machine-readable
      challenge) instead of a browser login redirect — which is what a script-driven caller needs.
- [ ] As defense in depth on top of the platform challenge, the endpoint script **asserts an
      authenticated user is present (`B.optUser`, fail-closed)** before doing anything. This is coded
      in the endpoint (task 4); nothing to configure here, but confirm it is present during the deploy.

### 3b. Create + store the Basic Auth credential in the skill's `.env`

The credential (and the endpoint URL) live in a **gitignored `.env` file the skill reads
directly** — `.claude/skills/release-email/.env`, copied from the committed `.env.example`. This is
a file, **not** a shell/`~/.profile` variable, so it doesn't depend on which shell sources what
(and my Bash tool is Git Bash while `~/.profile` is WSL's — the file avoids that mismatch entirely).
`.env` is gitignored repo-wide, so the secret never enters this public repo.

- [ ] Choose the Basic Auth secret. **Prefer a scoped access token or a dedicated service account
      over the maintainer's real account password**, if the platform accepts a token as the Basic
      Auth password. **Confirm during setup** whether BlueStep accepts a scoped token as the
      basic-auth secret; if not, fall back to the service account's password and note which identity
      the endpoint is configured for.
- [ ] Create the `.env` and fill both values:

      ```bash
      cd .claude/skills/release-email
      cp .env.example .env
      # then edit .env:
      #   B6P_RELEASE_EMAIL_URL=https://<host>/b/bspecs-release-email
      #   B6P_RELEASE_EMAIL_AUTH=<user>:<token-or-password>
      ```

- [ ] The skill loads it (`set -a; . .claude/skills/release-email/.env; set +a`) and sends the
      credential on **every** call (probe and send) as:

      ```
      Authorization: Basic base64($B6P_RELEASE_EMAIL_AUTH)
      ```

      i.e. base64 of the literal `user:secret` string. The credential is **never** logged, echoed
      in-session, or written to the repo/history.

> **Basic Auth is base64, not encryption** — it is safe only over HTTPS. The endpoint is
> `https://…bluestep.net`, so that holds; just never send it over a plain-HTTP path and never commit
> the value.

---

## 4. Host the logo PNG

The email is table-based with inline styles and references its logo by **absolute URL** (the template
carries a `[LOGO_URL]` placeholder — see task 3). Email clients will not render an SVG or a
repo-relative path, so the logo must be a **hosted PNG**.

- [ ] Have the logo as a **PNG** (transparent background; sized for retina — a large square scaled
      down in the email reads crisply). SVG will not render in email.
- [ ] Upload it to a **Media Library / Record Files folder** (e.g. `Bspecs Email Assets`) and set the
      file's permission to **Everyone: Reader** so email clients can fetch it with no login. The
      download URL looks like `https://<host>/download/<file-id>/<name>.png`.
- [ ] **Confirm it's public** — fetch the URL with **no auth** and check for `HTTP 200` +
      `Content-Type: image/png` (not a login page):

      ```bash
      curl -sS -D - -o /dev/null "https://<host>/download/<file-id>/<name>.png"
      ```

- [ ] Put the URL in **`.claude/skills/release-email/assets.local.json`** as `logoUrl` (a gitignored,
      non-secret config the skill reads to fill `[LOGO_URL]`) — **not** hardcoded in the committed
      template. The logo is a stable, always-available asset, so this URL rarely changes.

---

## 5. Push the endpoint

The endpoint is a **BlueStep component that lives on BlueHQ** — its source of truth is the platform
component, and there is **no committed in-repo copy** (it references org-internal identifiers and is
internal ops, not shipped plugin tooling). Author and edit it through a **gitignored local working
copy**, exactly like the feedback intake.

- [ ] The endpoint source lives in the gitignored working copy
      **`platform/U<org>/BlueStep Tools Release Email/`** (the `platform/U*/` prefix is excluded by
      `.gitignore` — confirm it is ignored before you push, per the spec wrap-up: no `platform/U*/`
      path and **no recipient address** may appear anywhere under version control).
- [ ] Push it to BlueHQ with **`b6p push`** from that working copy.
- [ ] **Snapshot to compile + publish.** The live `/b/` endpoint only picks up new code after a
      **snapshot** (compile + publish) — either a manual snapshot on the platform or
      `b6p push --snapshot --message "…"`. A plain `b6p push` alone can leave stale (or empty) compiled
      JS, in which case the endpoint returns an **empty `200`**. If a call comes back empty, snapshot
      and retry.
- [ ] Confirm the endpoint reads the section-1 config form (recipients, sender fields, watermarks
      resolve at runtime; a missing/misread form should return a clear error, not a silent drop).
- [ ] Note the deployed endpoint's public URL and set it as **`B6P_RELEASE_EMAIL_URL`** in the
      skill's gitignored `.env` (§3b), alongside `B6P_RELEASE_EMAIL_AUTH` — the skill reads it from
      there so the org-specific URL stays **out of the public repo**, never hardcoded. It is
      restricted, holds no send secret, and is the value the skill probes/POSTs to.

---

## 6. Payload / response contract (reference — no setup action)

This is the single source of truth both the endpoint (task 4) and the skill (task 5) code against.
**Nothing to create here** — it is the shape enforced in code, listed so the two halves stay in sync.
Every call carries the `Authorization: Basic …` header from section 3b.

### 6a. Probe — `GET ?probe=1`

Returns the current watermarks + how many recipients are configured, **without sending anything** and
**without ever returning the addresses**:

```json
{
  "watermark":          { "plugin": "<lastPluginVersion>", "cli": "<lastCliVersion>" },
  "recipientCount":     <number>,
  "testRecipientCount": <number>,
  "froms":              "<froms value>",
  "sender":             "<sender value>",
  "replyTo":            "<replyTo value>"
}
```

> `recipientCount` / `testRecipientCount` are **counts**, never the lists. The `froms` / `sender` /
> `replyTo` values are the sender identity (safe to show), **not** recipient addresses.

### 6b. Send — `POST`

Body (the skill builds the finished HTML and text; the endpoint stores no template and renders
nothing):

```json
{
  "fromVersions": { "plugin": "<watermark plugin>", "cli": "<watermark cli>" },
  "toVersions":   { "plugin": "<newest plugin>",    "cli": "<newest cli>" },
  "subject":      "<subject line>",
  "html":         "<finished email-safe HTML>",
  "text":         "<plain-text alternative>",
  "test":         false
}
```

- `fromVersions` / `toVersions` carry each product's range; the endpoint advances **only** the
  watermark(s) for products present in the payload (a plugin-only send omits/leaves the CLI half).
- **`test`** (optional, default `false`): when `true`, the endpoint sends to the **`testRecipients`**
  field (the preview/validation audience) instead of `recipients`, and does **NOT** advance any
  watermark — for the preview/deliverability check in section 7. It errors if `testRecipients` is
  empty (never falls back to the real list).

### 6c. Response

```json
{
  "ok":        true,
  "sentCount": <number>,
  "failures":  [ { "email": "<addr>", "error": "<reason>" } ],
  "watermark": { "plugin": "<new lastPluginVersion>", "cli": "<new lastCliVersion>" }
}
```

- `failures` is returned to the skill for **in-session** follow-up only — per the ADR's hard rule,
  failing addresses are **never** persisted to the repo.
- `watermark` echoes the values after the (real, non-test) send so the skill can confirm the advance.

---

## 7. Verify

Run these against the deployed endpoint. (`$ENDPOINT_URL` = `$B6P_RELEASE_EMAIL_URL` from section 5;
`$AUTH` is a convenience for `base64` of `$B6P_RELEASE_EMAIL_AUTH`.)

- [ ] **Probe returns watermarks + count, no addresses.** A `?probe=1` call comes back with the
      per-product watermark and `recipientCount` and **no recipient address** anywhere in the body.

      ```bash
      curl -sS "$ENDPOINT_URL?probe=1" \
        -H "Authorization: Basic $(printf %s "$B6P_RELEASE_EMAIL_AUTH" | base64)"
      ```

      - [ ] Response matches the 6a shape.
      - [ ] `recipientCount` is a number; the recipient addresses are **absent**.

- [ ] **Preview (test) send → validate the real email.** Put your own address(es) in the
      **`testRecipients`** field, POST a small payload with `"test": true`, and confirm the mail
      reaches those **preview** addresses (test mode sends to `testRecipients`, not `recipients`, and
      does **not** advance watermarks). Open it in **both Outlook (Word engine) and Gmail** and
      confirm:
      - [ ] the **"*X* on behalf of *Y*"** label renders when `froms` and `sender` are distinct
            addresses (with the same address, or an empty `sender`, it just shows "From: *name*");
      - [ ] the **display name** in `froms` shows correctly (this confirms whether the setter accepts a
            `"Display Name <addr>"` string);
      - [ ] the hosted **logo** loads (section 4) and the fallback fonts carry;
      - [ ] a re-probe afterward shows the watermarks **unchanged** (test mode did not advance them).

- [ ] **Unauthenticated call → clean `401`.** A request with **no** `Authorization` header gets a
      clean `401` (a challenge), **not** a login-page redirect and **not** the script running.

      ```bash
      curl -sS -o /dev/null -w '%{http_code}\n' "$ENDPOINT_URL?probe=1"
      # expect: 401
      ```

      - [ ] Status is `401`.
      - [ ] Nothing was sent and no watermark moved.

---

## Done when

- [ ] The config form holds `recipients` and `testRecipients` (memos), `froms` / `sender` /
      `replyTo` (Text, real addresses pinned), and `lastPluginVersion` / `lastCliVersion` (Text,
      seeded), with its read path recorded.
- [ ] The endpoint is **restricted**: "Request HTTP authentication" ON, **no** `Everyone: Reader`,
      access granted only to the maintainer/service user, and the script asserts `B.optUser`.
- [ ] `.claude/skills/release-email/.env` exists (copied from `.env.example`, gitignored) with
      `B6P_RELEASE_EMAIL_AUTH=user:secret` (a scoped token/service account where the platform
      allows) and `B6P_RELEASE_EMAIL_URL` set to the deployed endpoint URL — both out of the public
      repo; the skill reads the file directly (no shell/`~/.profile` dependency).
- [ ] The logo PNG is uploaded (Everyone: Reader), its no-auth fetch returns `200`/`image/png`, and
      its URL is in `assets.local.json` as `logoUrl` (the skill fills `[LOGO_URL]` from there).
- [ ] The endpoint is pushed + snapshotted from the gitignored `platform/U<org>/…` working copy, and
      **no** `platform/U*/` path or recipient address is under version control.
- [ ] All three checks in section 7 pass: probe (no addresses), test-mode send (on-behalf-of label +
      display name in Outlook + Gmail, watermarks unchanged), and a clean `401` for an unauthenticated
      call.

---

## Notes for future maintainers

- **The addresses live in exactly one place.** The `recipients` memo field on the config form — never
  the probe response, never the repo, never the sent-history files (those carry a **count**, not a
  list). If you ever see an address in a diff, stop and scrub it.
- **The form is the range source of truth, not the repo.** The skill always re-probes the watermark
  fields before drafting, so a stale local checkout is harmless. Do not "fix" a watermark by editing a
  history file — edit the form field.
- **Deliverability is the fragile part.** `sender` must stay an `@mail.bluestep.net`-hosted mailbox;
  if mail starts landing in spam, re-check that first. Any change to `froms` / `sender` is a
  test-mode-send-and-eyeball change (Outlook + Gmail), not a fire-and-forget edit.
- **Prefer a scoped token / service user for Basic Auth.** Rotating a real person's password to rotate
  the send credential is painful and couples the endpoint to one human. If the platform grows support
  for a token as the basic-auth password, migrate to it.

## See also

- [`decisions/release-update-email.md`](decisions/release-update-email.md) — the governing ADR (why
  the skill builds and the endpoint sends, why this endpoint is restricted, the no-addresses-in-the-repo
  rule).
- [`bluehq-feedback-endpoint-setup.md`](bluehq-feedback-endpoint-setup.md) — the sibling setup guide
  this one mirrors (token form, readable-field-type rule, `b6p push` + snapshot flow).
- [`decisions/feedback-intake-bluehq-endpoint.md`](decisions/feedback-intake-bluehq-endpoint.md) — the
  skill-builds / endpoint-sends split and the `B.util.email` send this reuses.
- [`decisions/content-sanitization-for-public-tooling.md`](decisions/content-sanitization-for-public-tooling.md)
  — the category-level content rule this file follows.
- Spec: `.claude/specs/release-update-email/` (requirements / design / tasks).
- The endpoint's source of truth is the **BlueStep component on BlueHQ** — edited via a gitignored
  `b6p`-pulled working copy under `platform/U<org>/BlueStep Tools Release Email/` and shipped with
  `b6p push` (no committed in-repo copy).
