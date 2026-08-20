---
description: BlueStep Platform overview — architecture (Relate/Connect/Manage/BsJs), the b6p CLI, sync, and component lifecycle. Read when orienting on the platform, working with the b6p CLI, or troubleshooting pull/push sync.
---

# B6P Platform Workflow

Platform orientation plus the workflow reference for sync, lifecycle, and the b6p CLI. Critical rules live in `AGENTS.md`; on-demand detail lives in the skill index (`SKILL.md`).

## Contents

- [Platform architecture](#platform-architecture)
- [Workspace model](#workspace-model)
- [Data hierarchy](#data-hierarchy)
- [Script types](#script-types)
- [Anonymous access — two independent grants](#anonymous-access--two-independent-grants)
- [b6p CLI workflow](#b6p-cli-workflow)
- [Sync metadata](#sync-metadata)
- [Files Claude must never edit](#files-claude-must-never-edit)
- [Imports — verification flow](#imports--verification-flow)
- [When the CLI fails](#when-the-cli-fails)
- [When `B.commit()` is required](#when-bcommit-is-required)

## Platform architecture

The BlueStep Platform is three web applications over one shared data layer:

- **Relate** — the database and configuration layer. Defines the data model (**Type → Category → Form → Field**) and holds all structured records.
- **Connect** — end-user web pages that view or enter Relate data. Connect pages embed MergeReports.
- **Manage** — the administrative counterpart to Connect; also hosts MergeReports.
- **BlueStep.js (BsJs)** — the TypeScript library used to build the three component types: MergeReports, Endpoints, and Formulas. Patterns and APIs: `bsjs-development.md`.

**Relate data model (configuration view).** A **Type** is a high-level entity (Individual, Organization, Event); a **Category** sub-classifies it (Staff, Volunteer, Client) — a record has one Type and zero or more Categories; a **Form** is a named group of fields; a **Field** is one data element. This is the *configuration* model; the runtime/storage nesting is in "Data hierarchy" below.

### MergeReports are embedded, not standalone

A MergeReport does not render a whole page. Connect (or Manage) supplies the page shell — `<html>`/`<head>`/`<body>`, site navigation, and branding — and the MergeReport's `pageContent()` output and `static/index.html` are injected into it. Write MergeReport frontend assuming the host page already exists; do not emit a full HTML document. Detail: `reference/merge-report-static-index.md`, `reference/component-library.md`.

- `B.siteNavigation()` — the host site's navigation tree.
- `B.isLayout("MANAGE")` — branch on whether the page is a Manage or Connect layout.
- `B.optUser` / `B.user` — the logged-in user (`B.user` is null in scheduled scripts; see "Script types").

## Workspace model

The workspace is a **local copy** of components that live on the BlueStep platform. The platform is the source of truth.

- New B6P components (MergeReport, Endpoint, Formula) are created **on the platform**, never locally.
- Inside an existing component, creating new `.ts` files locally is fine — they ship to the platform on `push`.
- Compilation happens at **publish/snapshot** time, never locally — local `tsc` is forbidden (enforced by hook), and a plain push does not compile at all.

## Data hierarchy

```
Organization
└── Unit (folder: U######)
    └── BaseRecord
        └── Form
            └── Entry
                └── Field
```

Queries, scripts, and permissions are scoped per Unit by default. A local project may pull components from multiple Units; each lives under its own `U######/` folder created by `b6p pull` on first pull.

<!-- CONFLICT: U###### identity — this overview treats U###### as the Unit folder created by `b6p pull` (nested under an Organization). Another platform-overview source labels U###### as the Organization's own ID. Needs human resolution. -->

## Script types

| Type           | `B.user` available | Notes                                              |
|----------------|--------------------|----------------------------------------------------|
| Post-Save      | Yes                | Runs after a record is saved                       |
| MergeReport    | Yes                | Page renderer; frontend in `static/`               |
| Endpoint       | Yes                | HTTP-style request handler                         |
| OnDemand       | Yes                | User-triggered formula — runs on the task pod; ~5 s scheduler-queue delay before start |
| Field Formula  | Yes                | Computes a field's value                           |
| Scheduled      | **No (null)**      | Runs on cron; guard `B.user` accordingly           |
| Section Script | Yes                | Page section logic                                 |

### OnDemand — async/background use cases

OnDemand formulas execute on the **task pod**, making them appropriate for heavy or long-running work that should not run on a production pod. They are a good fit for async, background, or batch tasks.

**Do not use OnDemand on a user's synchronous wait path.** The platform's scheduler queues the formula and starts it "as soon as possible," but that incurs a ~5 second delay before execution begins. For user-facing create or update flows where latency matters, use a synchronous task-pod **Endpoint** instead. See `bsjs-development.md` → "OnDemand / Field Formula" for code patterns.

## Anonymous access — two independent grants

Serving anything to an **unauthenticated visitor** needs **two independent grants**, and they are
easy to miss because failing either produces a different symptom:

- **"Everyone: Reader" on the ENDPOINT** — grants execute.
- **"Everyone: Relate Author" on the FORM** — grants create.

Both are required for an anonymous write. **Anonymous writes need NO elevated script authority**
(verified live) — the natural assumption is the opposite, and an elevated-authority fallback is
expensive to build for nothing.

The diagnostic cleanly separates the two failure modes:

| Response | Meaning |
| --- | --- |
| `403` | existing alias, no permission — fix the grants above |
| `500` Error | unknown alias — wrong path, the endpoint was never reached |

For the unauthenticated-fallback *behavior* on an endpoint (clean `401` vs a JSON-breaking `302`
login redirect via "Request HTTP authentication"), see `reference/session-cookie-forwarding.md` —
that setting is adjacent to, but distinct from, the grants themselves.

## b6p CLI workflow

`b6p` is a standalone binary on the system `PATH` (the b6p-cli standalone artifact, installed separately from this tooling). Invoke it directly — no `npx`, no devDependency, no `npm install`. The shape is:

```
b6p <subcommand> ...
```

### Pull a component

```
b6p pull "<DAV URL>"
```

**`b6p pull` takes a DAV URL, not a display name.** The URL is copied from the component's page in the BlueStep platform UI. There is no name-based lookup; the CLI has no way to find a component by its label.

`b6p pull --help` reference:

```
Usage: b6p pull [options] [formula-url]

Pull a script from a WebDAV location

Options:
  --file <path>       Derive source from local file metadata
  --workspace <path>  Target workspace folder (default: cwd)
```

A successful first pull:

- Creates the `U######/` folder (if not present) and the `<ComponentName>/` subfolder under it
- Populates `draft/scripts/` and (in older modules) `draft/objects/`; `draft/info/` is **omitted for most components** — its absence is normal, not a broken pull
- Populates `declarations/` with the platform-generated `.d.ts` files, including `declarations/index.d.ts` (field/query/form declarations)
- Records the component's sync metadata (WebDAV id, file hashes, script key) so future pulls/pushes can resolve it

Subsequent pulls verify per-file integrity and only rewrite files whose content changed.

### Push a component

The cleanest way to push an already-pulled component is `--file`, which lets the CLI derive the destination DAV URL from the recorded sync metadata:

```
b6p push --file "U######/<Component>/draft/scripts/app.ts"
```

Any file inside the component works as the `--file` argument; the CLI walks up to find the component root and looks up its recorded sync metadata. Same per-file integrity check applies — only changed files are uploaded. A plain push uploads the draft source **as-is** — it does **not** compile and does **not** change the live version. Only a **publish/snapshot** (`b6p push --snapshot --message "…"`) runs the TypeScript build and ships the compiled `app.js`.

### Fallback: VS Code extension

If the `b6p` CLI fails (network, lock, auth), the VS Code **b6p extension** is an equivalent fallback for pull/push operations.

## Sync metadata

Auto-managed by the CLI and stored internally (no longer a `.b6p_metadata.json` file in the workspace; legacy files are migrated on first run). Tracks WebDAV IDs, last-pull / last-push timestamps, file hashes, and script keys, so pull/push/audit can resolve each component. Not something you edit.

## Files Claude must never edit

Enforced by the `block-generated-files` hook:

- Anything under `declarations/`
- `B.d.ts`, `scriptlibrary.d.ts`, `Globals.d.ts`
- (Treat `declarations/index.d.ts` as platform-generated — it regenerates on pull. `draft/objects/imports.ts` is a legacy artifact in older modules; do not edit it either.)

If declarations are wrong, fix it on the platform and pull, not by editing locally.

## Imports — verification flow

Form-field imports are **per-component**. Each component independently declares which fields of a form it imports. A field present in component A's `declarations/index.d.ts` is not visible to component B unless B's import config was updated on the platform and B was pulled separately.

Before referencing a query/form/field in code:

1. Open **the component you are editing**'s `declarations/index.d.ts` and confirm the name exists. Another component's declarations file tells you nothing.
2. In older modules, `draft/objects/imports.ts` may also exist as a legacy artifact — ignore it for verification; new declarations land in `declarations/index.d.ts`.
3. If missing:
   - Add the field to **this component's** form-import config on the platform.
   - `b6p pull "<DAV URL>"` to regenerate this component's declarations.
   - Then write the TypeScript reference.

If N components all need the same new field, each one needs its own import-config update on the platform and a separate pull.

Hallucinated names are **not** caught at publish: the push transpile runs without the component's `declarations/`, so a fabricated name is indistinguishable from the benign `Cannot find name` noise and the broken code ships anyway (see the diagnostics guidance in the `/b6p-push` skill). The only gate is checking `declarations/index.d.ts` before writing the reference.

## When the CLI fails

Common causes:

- `b6p` cannot be found — the b6p-cli standalone binary isn't installed or isn't on `PATH`. Install it from its release.
- Network/auth issue with the platform. Re-authenticate with `b6p auth set`.
- Local file lock. Close VS Code, retry.

Fallbacks:

1. The VS Code b6p extension provides the same pull/push operations through the editor UI.
2. As a last resort, the platform UI lets you download/upload component files manually — but manual uploads bypass the CLI's recorded sync metadata, making future CLI sync fragile.

## When `B.commit()` is required

The platform commits automatically when a script finishes. Call `B.commit()` manually only when:

- A new entry's `id` is needed before the script ends.
- A subsequent read in the same script must see writes that haven't fired post-saves yet.

In most scripts, manual `B.commit()` is unnecessary.
