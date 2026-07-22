# BlueHQ feedback endpoint — one-time setup

**Status:** Done — the endpoint was stood up and **verified working end-to-end on 2026-07-22** (a well-formed POST created a linked ClickUp task + GitHub issue; a malformed POST returned a clean error with no task). This doc is retained as the reproducible checklist for standing the path up again (or in another org).

A runnable, category-level checklist for standing up the `/bspecs-feedback` intake path: the
**public BlueHQ endpoint** the skill POSTs to, plus the three one-time platform/admin steps it depends
on and the deploy + smoke test that finishes the job. This covers spec `feedback-clickup-form` tasks
**1–3** (platform/admin provisioning) and the deploy/verify half of tasks **4–5**.

Read the governing ADR — [`decisions/feedback-intake-bluehq-endpoint.md`](decisions/feedback-intake-bluehq-endpoint.md) —
for *why* the transport is a BlueHQ endpoint rather than a browser GitHub-issue link. This doc is the
*how*.

> **This file is committed to a public repo.** It stays **category-level** per
> [`decisions/content-sanitization-for-public-tooling.md`](decisions/content-sanitization-for-public-tooling.md):
> **no secrets or tokens**, **no employee names**, **no internal admin deep-links**. The ClickUp AI.List
> id (`901414350506`) is project infrastructure that already appears in this repo's `.github/workflows/`,
> so it is fine to name; everything else org-internal is described by navigation path only.

> **How to read the checkboxes.** Every `[ ]` is a step an admin ticks as they go. Where the spec did not
> pin an exact UI path or option value, the step says **"confirm during setup"** — fill in the real value
> in your own run notes, do not guess it here.

---

## 0. Prerequisites & order

The platform work is the **critical path** — the endpoint is useless until all three provisioning steps
exist. Do them in this order; sections 1 and 2 are independent of each other and can run in parallel, but
section 3 needs the outputs of both, and section 4 needs all three.

| # | Step | Owner | Blocks |
| --- | --- | --- | --- |
| 1 | Provision the GitHub App | GitHub **org admin** for `Bluestep-Systems` | 3, 4 |
| 2 | Create ClickUp fields + per-repo `feedback` label | ClickUp workspace admin | 4 |
| 3 | Create the BlueHQ token form | BlueHQ admin | 4 |
| 4 | Deploy the endpoint + smoke test | BlueHQ admin | — |

> ✅ **All four sections were completed on 2026-07-22.** Section 1 (the GitHub App) initially blocked the
> deploy/test side until an org admin provisioned it; once the App creds landed in the token form, the
> endpoint deployed and both smoke tests passed. The steps below stay written as a fresh-run checklist.

---

## 1. Provision the GitHub App

The endpoint files a GitHub issue on whichever repo the feedback routes to. The default Actions
`GITHUB_TOKEN` **cannot write issues cross-repo**, so the endpoint authenticates as a dedicated **GitHub
App** whose credentials live only in the BlueHQ token form (section 3) — never in the plugin, never in
Actions secrets.

- [ ] Create a **GitHub App** on the `Bluestep-Systems` org (org **Settings → Developer settings → GitHub
      Apps → New GitHub App**; confirm the exact menu label during setup — GitHub moves it occasionally).
- [ ] **Permissions:** grant **Repository → Issues: Read & write** and **nothing else**. No
      label-management scope is needed (the endpoint only applies the pre-existing `feedback` label — see
      section 2). Leave all other permissions at *No access*.
- [ ] **Install** the App on the org, scoped to exactly three repositories: **`bspecs`**, **`b6p-cli`**,
      and **`web`**. (Do not grant *All repositories* — least privilege.)
- [ ] **Capture** these three values for section 3 — treat all three as secrets, do not paste them into
      any committed file:
  - **App ID** (shown on the App's settings page).
  - **Installation ID** (from the installation URL / the installations API after installing).
  - **Private key** — generate one on the App settings page; it downloads a `.pem` **once**. Store it
    securely; you cannot re-download it (only regenerate). Note that clicking *Generate a private key*
    **twice registers two valid keys** on the App — delete the unused one so only the key you deploy stays
    live.
  - **Convert the private key to PKCS#8 before storing it.** GitHub's download is **PKCS#1**
    (`-----BEGIN RSA PRIVATE KEY-----`), but the endpoint's JWT signing expects **PKCS#8**
    (`-----BEGIN PRIVATE KEY-----`). Convert once:

    ```bash
    openssl pkcs8 -topk8 -nocrypt -in <downloaded>.pem -out <app-key-pkcs8>.pem
    ```

    Paste the **PKCS#8** result (the `-----BEGIN PRIVATE KEY-----` block) into the token form in section 3.

**Fallback if the App install is denied.** A **fine-grained personal access token (PAT)** scoped to the
three repos with **Issues: Read & write** works as a substitute. It still requires the token owner to have
write access to all three repos, and it is tied to a person rather than an auditable/revocable App — so
prefer the App. If you use a PAT, store it in the same token form (section 3) in place of the App creds and
note which identity the endpoint is configured for.

---

## 2. Create the ClickUp custom fields + per-repo `feedback` label

The endpoint creates the ClickUp task on **AI.List** (`901414350506`) and sets the structured axes as
custom fields. These fields must **pre-exist with their options** — the endpoint sets an existing option,
it never mints options at runtime.

### 2a. Native fields — no custom field to create

Two axes map onto **native** ClickUp fields the list already has. Do **not** create custom fields for
these:

- [ ] **severity → native Priority.** Confirm the list's Priority field is enabled. The endpoint maps:

  | severity | ClickUp priority |
  | --- | --- |
  | `blocking` | Urgent |
  | `major` | High |
  | `minor` | Normal |
  | `cosmetic` | Low |

- [ ] **stage / lifecycle → native Status.** The list already has the statuses
      `Open → up next → in progress → blocked/waiting → review/test → git → on-going → Closed`. Confirm they
      are present; no custom field.

### 2b. Custom fields to create on AI.List

Create each field below on AI.List (**List settings → Custom Fields → + Create field**, or via the ClickUp
API). Field **names** and **types** are fixed by the design; **option values** marked *(confirm during
setup)* were not pinned in the spec — seed them from the values here and finalize per the `#25` taxonomy
trim, then record what you actually created.

- [ ] **`component`** — type **Dropdown** (single-select). *The kind of thing that was being built.*
      Options: **confirm during setup** (per the taxonomy trim). Seed value present in the spec: `form`.
      Add the remaining component kinds you expect (e.g. field / endpoint / report — **confirm during
      setup**) rather than over-populating; dropdown options are cheap to add later, annoying to remove
      once used.
- [ ] **`failure`** — type **Labels** (multi-select). *How the AI output failed (one or more).* Options:
      seed values present in the spec: `missing-fields`, `wrong-logic`. Add further failure modes only as
      needed — **confirm during setup**.
- [ ] **`ai`** — type **Dropdown** (single-select). *Was the AI confident?* Options: seed value present in
      the spec: `confident-wrong`. Add the remaining confidence states (e.g. a "flagged uncertainty" value)
      — **confirm during setup**.
- [ ] **`kind`** — type **Labels** (multi-select). Preserves today's taxonomy. Options (authoritative,
      from the retired feedback issue form): `add rule`, `change rule`, `remove rule`, `report error/bug`,
      `request capability`, `report friction`.
- [ ] **`target`** — type **Labels** (multi-select). The artifact(s) the feedback hits. Options
      (authoritative, from the retired feedback issue form): `instruction`, `skill`, `subagent`, `hook`,
      `settings / permission`, `spec template`, `module template`, `CLAUDE.md`, `CLI`.
- [ ] **`version`** — type **Text**. The plugin version the feedback was filed from (the endpoint writes it
      verbatim). No options.
- [ ] **`reporter`** — type **Text** (or **Email** if you prefer email validation; the payload carries an
      optional name + email). Holds the optional reporter identity. No options.

> `component` / `failure` / `ai` only carry a value for **AI-output-failure** feedback; for rule /
> capability / friction feedback the skill leaves them empty and the endpoint sets nothing.

### 2c. Per-repo `feedback` label on GitHub

GitHub **silently drops labels that don't exist** in the target repo, and issues can land on any of the
three repos. The generated issue carries **only** the single `feedback` label (the axes ride as a body
text-line, not as labels), so that one label must exist on every routable repo.

- [ ] `bspecs` — **already has** the `feedback` label (nothing to do; verify it is still present).
- [ ] `b6p-cli` — **create** a `feedback` label (Issues → Labels → New label).
- [ ] `web` — **create** a `feedback` label.

No other labels are minted for feedback across the three repos.

### 2d. Routing allow-list — reference (no setup action)

This subsection records what the endpoint actually accepts for `routing`, so the skill's hints and the
payload examples have a single source of truth. **Nothing to create here** — it is the contract enforced
in code, listed so it stays in sync.

- **`routing.repo`** — validated against a fixed set: `bspecs`, `b6p-cli`, `web`. Anything else (or
  absent) falls back to **`bspecs`**.
- **`routing.labels`** — validated by **prefix only**, against these four allowed prefixes:

  | prefix | meaning |
  | --- | --- |
  | `type:` | what kind of change (`type:rule`, `type:bug`, `type:capability`, …) |
  | `area:` | which artifact area (`area:plugin-skill`, `area:hook`, `area:reference`, …) |
  | `priority:` | triage priority hint (`priority:p1`, `priority:p2`, …) |
  | `status:` | lifecycle hint (`status:triage`, …) |

  A label is kept if it **begins with** one of these prefixes; the text after the prefix is **free-form
  and not checked against a value list**. Labels that match no prefix are dropped. If nothing survives,
  the endpoint defaults to **`status:triage`**.
- **Where the labels go.** Surviving labels are **not** applied as GitHub labels and are **not** written
  to ClickUp fields — they are rendered as a single `Labels: …` text-line in the generated GitHub issue
  body (the GitHub issue itself always carries only the `feedback` label; see 2c). Priority as a *native
  ClickUp* signal comes from the `severity` axis (section 2a), **not** from `priority:*`.

> Because the suffix is free-form, `priority:p1`/`priority:p2` are conventions, not an enforced set —
> keep the skill's examples to that range for consistency, but the endpoint would accept any `priority:` value.

---

## 3. Create the BlueHQ token form

The endpoint reads its credentials at runtime from a **single-entry form on the top-level office** in
BlueHQ. This keeps every secret on the platform and out of both the public plugin and GitHub Actions.

- [ ] In the **BlueHQ Admin UI**, navigate to the **top-level office** and **create a single-entry form**
      on it (Admin → the top-level office's setup → create form). The exact menu path is org-internal —
      **confirm during setup**; do not record the internal admin deep-link in this (public) file.
- [ ] Add fields to hold the credentials captured earlier. **Use readable field types — not Secret /
      password fields:**
  - [ ] **ClickUp API token** — the `pk_…` personal API token with access to the AI space / AI.List.
        Type: **Text**.
  - [ ] **GitHub App — App ID** (from section 1). Type: **Text**.
  - [ ] **GitHub App — Installation ID** (from section 1). Type: **Text**.
  - [ ] **GitHub App — private key** — the **PKCS#8** `.pem` contents (from section 1, converted). Type:
        **Memo / Text Area** (multi-line, so the whole PEM fits). (If you fell back to a fine-grained PAT,
        store the PAT in a Text field here instead and note it.)

> ⚠️ **Do not use a Secret / password field type for these.** A Secret field is **one-way** — the platform
> hashes it and can only *verify* a value, never return the plaintext — so the endpoint could not read the
> token or PEM back. Machine credentials the script must *read* have to be a readable type (Text / Memo).
> **Field types cannot be changed after a field is created** — if you created these as Secret by mistake,
> **delete and recreate** them as Text / Memo.
>
> **Hide the plaintext with access control, not hashing.** Lock the form down with **view permissions**
> (restrict who can see the fields) and/or a **`HIDDEN_DEFAULT`** field control so the values are not shown
> to unauthorized users — that is how you keep a readable machine credential private. The endpoint reads
> the fields server-side regardless of the view permissions.

- [ ] Note the form's **read path** (the field identifiers / lookup the endpoint script uses to read these
      values server-side). Record it in your run notes and wire it into the endpoint config — **confirm
      during setup**; keep the concrete path out of this committed file.

> The form is **read-only to the endpoint** and never leaves the platform. Nothing here ships in the
> plugin.

---

## 4. Deploy the endpoint + smoke test

The endpoint is a **BlueStep component that lives on BlueHQ** — its source of truth is the platform
component itself, and there is **no committed in-repo copy** (the source references org-internal identifiers
and it is internal infrastructure, not public plugin tooling). Author and edit it through a **gitignored
local working copy**: pull it with `b6p` into `platform/U*/` (which `.gitignore` excludes), edit there, and
ship with `b6p push`. Tokens come from the form in section 3 at runtime, so the endpoint holds no secret.

### 4a. Deploy

- [ ] Push the BsJs endpoint from the gitignored working copy (`platform/U*/…`) to BlueHQ with `b6p push`.
- [ ] **Snapshot to compile + publish.** The live `/b/` endpoint only picks up new code after a
      **snapshot** (compile + publish) — either a manual snapshot on the platform or
      `b6p push --snapshot --message "…"`. A plain `b6p push` alone can leave stale (or empty) compiled JS,
      in which case the endpoint returns an **empty `200`**. If a call comes back empty, snapshot and retry.
- [ ] Confirm the endpoint reads the token form from section 3 (App creds + ClickUp token resolve at
      runtime; a missing/misread form should return a clear error, not a silent drop).
- [ ] Note the deployed endpoint's public URL. (It is intake-only, holds no secret, and is
      hardcoded into the `/bspecs-feedback` skill — project infrastructure, so it is not a secret; still,
      record it in your run notes as the value the skill must point at.)

### 4b. Smoke test

Run these two checks against the deployed endpoint. (`$ENDPOINT_URL` = the deployed URL from 4a.)

- [ ] **Well-formed payload → task + linked issue.** POST a valid feedback body and confirm a ClickUp task
      is created on AI.List **and** a GitHub issue appears on the routed repo, with the issue URL commented
      back on the task and both URLs returned in the response.

  ```bash
  curl -sS -X POST "$ENDPOINT_URL" \
    -H "Content-Type: application/json" \
    -d '{
      "kind": ["report error/bug"],
      "target": ["skill"],
      "description": "Smoke test — please delete. Verifying the BlueHQ feedback intake path.",
      "pluginVersion": "0.0.0-smoketest",
      "routing": { "repo": "bspecs", "labels": ["type:rule", "area:plugin-skill", "priority:p2"] }
    }'
  ```

  Expect a JSON response of the shape `{ "taskUrl": "…", "issueUrl": "…" }`. Verify:
  - [ ] a task exists on **AI.List** (`901414350506`) with the description and `kind` / `target` / `version`
        set;
  - [ ] a GitHub issue exists on the routed repo (`bspecs` here) carrying **only** the `feedback` label and
        an axes body text-line;
  - [ ] the issue URL is commented back on the ClickUp task.
  - [ ] **Clean up** the smoke-test task and issue afterward.

- [ ] **Malformed payload → clean error, no task.** POST an invalid body and confirm the endpoint returns a
      clean error and **creates no ClickUp task** (drop-on-malformed).

  ```bash
  curl -sS -X POST "$ENDPOINT_URL" \
    -H "Content-Type: application/json" \
    -d '{ "not_a_valid": "payload" }'
  ```

  - [ ] Response is a clear error (not a 5xx stack trace, not a success).
  - [ ] **No** task was created on AI.List.

- [ ] *(Optional)* **GitHub-down / partial failure.** If you can simulate the GitHub write failing, confirm
      the endpoint still returns the `taskUrl` plus an error note — the task is the system of record and
      feedback is never lost even when the issue step fails.

---

## Done when

✅ **All of the below were satisfied on 2026-07-22** (verified working end-to-end).

- [x] The GitHub App (or PAT fallback) exists, is installed on the three repos with **Issues: Read &
      write**, and its creds are captured (private key converted to PKCS#8).
- [x] AI.List has the seven custom fields with their options; `feedback` exists on all three repos;
      severity/stage confirmed mapping to native priority/status.
- [x] The token form holds the ClickUp token + App creds in **readable** (Text / Memo) fields, locked down
      by view permissions, and the endpoint's read path is recorded.
- [x] The endpoint is deployed (pushed + snapshotted) and both smoke tests pass; the skill's hardcoded
      endpoint URL matches the deployed URL.

## See also

- [`decisions/feedback-intake-bluehq-endpoint.md`](decisions/feedback-intake-bluehq-endpoint.md) — the
  governing ADR (why a BlueHQ endpoint, options grid, superseding the browser-link mechanism).
- [`decisions/content-sanitization-for-public-tooling.md`](decisions/content-sanitization-for-public-tooling.md)
  — the category-level content rule this file follows.
- Spec: `.claude/specs/feedback-clickup-form/` (requirements / design / tasks 1–5).
- The endpoint's source of truth is the **BlueStep component on BlueHQ** — edited via a gitignored
  `b6p`-pulled working copy under `platform/U*/` and shipped with `b6p push` (no committed in-repo copy).
