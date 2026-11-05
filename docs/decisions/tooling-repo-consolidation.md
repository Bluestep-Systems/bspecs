# ADR: One tooling repo per visibility, several plugins per repo

**Status:** Accepted (2026-11-03). Phases 1 to 3 are done (phase 2 rolled out 2026-11-04, phase 3
on 2026-11-05; see "Phase 2 amendment" and "Phase 3 amendment"). Phases 4 and 5 are planned.

**Date:** 2026-11-03

**Relates to:** [`cross-tool-plugin-output.md`](cross-tool-plugin-output.md) (amended for the
per-plugin layout), [`client-data-guard.md`](client-data-guard.md) (amended: the write-time hook is
its own plugin), [`content-sanitization-for-public-tooling.md`](content-sanitization-for-public-tooling.md),
[`plugin-distribution.md`](plugin-distribution.md).

## Context

BlueStep's agent tooling had grown into three repos, each shipping one plugin:

- **this repo** (`Bluestep-Systems/bspecs`, public) — `bluestep-tools`, plus the `bluestep`
  marketplace that also pointed at the other two;
- **the core-tools repo** (public) — `core-tools`, the base workflow for repos that are not
  BlueStep components;
- **the one-tools repo** — `one-tools`, the BlueStep One work, a mix of public-worthy platform
  knowledge and internal team process.

The platform team proposed folding these into one repo per visibility level, each holding several
plugins, with every mod as its own plugin entry instead of a hook bolted onto bluestep-tools. The
proposal also asked for a fresh public repo, to start without the old history.

Two facts shaped the answer. First, a fresh repo does not make the old history go away: forks of
this repo and the old npm tarballs keep their own copies. Second, a fresh repo costs a lot: every install line, the `extraKnownMarketplaces` block `/b6p-setup` wrote into every
B6P project's `.claude/settings.json`, the open issues, the `plugin-v*` tags and the links from the
issue tracker all point at this repo.

The write-time client-data hook (`phi-guard`) was also looking for a home. It shipped inside
bluestep-tools in 0.41.0, which turned it on for every install, including machines whose projects
hold no client data.

## Decisions

1. **Rename, don't rebuild.** This repo is renamed (phase 2) rather than replaced. GitHub keeps a
   redirect for git and web, so `marketplace add Bluestep-Systems/bspecs` keeps working while the
   strings are migrated. The history purge is its own optional step on the renamed repo, and it
   works the same there as on a new one.
2. **One repo per visibility, several plugins per repo.** A public repo with the `bluestep`
   marketplace, an internal one with its own marketplace. Each plugin installs on its own.
3. **Every plugin lives in `plugins/<name>/`** with its own `.claude-plugin/plugin.json`,
   `README.md` and `CHANGELOG.md`. The root `README.md` is a catalog (one row per plugin), the
   root `CHANGELOG.md` points at the per-plugin files. Each plugin has its own version stream and
   its own tags, `<name>-v<version>`; a merge to `main` tags every plugin whose version has no tag
   yet. Cross-tool output is opt-in per plugin with a top-level `"crossTool"` boolean in its
   manifest; the generator walks `plugins/*` and emits `dist/cursor/<name>/` and
   `dist/codex/<name>/` only for plugins that set it. Adding a plugin is a folder, not a repo.
4. **Names stay.** The marketplace stays `bluestep` and every plugin keeps its name. Renaming a
   plugin would break the `enabledPlugins` keys in project settings, the plugin checks in the setup
   skills and the migrations, all in the same move. Two invariants follow, and any later change to
   the layout must keep them:
   - **MCP tool names embed the plugin name**, so a plugin that ships an MCP server cannot be
     renamed without breaking every reference to its tools. Plugin names do not change.
   - **`${CLAUDE_PLUGIN_ROOT}` never crosses plugins.** A plugin reads only its own files. A file
     two plugins need exists once in each, and `npm run gen:check` fails if the copies differ by a
     byte (today: the client-data detector and the hook input helper). One stated exception: the
     bluestep-tools canary tests whether a `phi-guard` folder exists next to its own plugin root in
     the marketplace cache (`plugins/cache/<marketplace>/<plugin>/<version>/`) and reads nothing in
     it. There is no hook-side signal for "is this other plugin installed"; the folder test is the
     cheapest one, it is skipped outside that layout, and the nudge line admits it can be wrong
     for an install that reached the machine another way.
5. **phi-guard is its own opt-in plugin.** Not every client handles PHI, so the write-time check
   is installed by whoever owns a machine that works on such projects, once per machine (user
   scope). It acts only inside B6P projects, and a project turns it off with
   `"enabledPlugins": { "phi-guard@bluestep": false }`. The git client-data check that
   `/b6p-setup` installs in every B6P project is not part of the plugin and stays the required
   gate. The cost is that an update to bluestep-tools 0.42.0 drops the write-time check from
   machines that had it; that loss is announced where it can be: bluestep-tools' `SessionStart`
   canary prints one line in a project that runs the git check without phi-guard installed (Claude
   Code), and `/b6p-setup` offers the install on every tool. A project that never ran `/b6p-setup`
   since 0.41.0 has no git check and gets no line; it hears about phi-guard the next time
   `/b6p-setup` runs there. 0.41.0 shipped one day before this decision, so few machines are in
   that state.
6. **core-tools moves in, Claude Code-only for now.** It is copied into `plugins/core-tools/` (a
   copy, not a subtree) and ships from here from 0.5.0. Its rule set lives in a `lane/` folder the
   cross-tool emitters do not carry, so on Cursor and Codex it would ship broken; it sets
   `"crossTool": false` until the emitters learn to carry extra folders.
7. **one-tools stays listed in the public marketplace until the internal one exists.** Removing
   the entry first would cut staff off from one-tools updates. It goes private as a starting
   point, not as a verdict: most of what it holds is platform knowledge that only needs the
   sanitization pass, and a later phase splits it into a public part and an internal part.
8. **Phase order.**
   1. **Multi-plugin layout in this repo** — the decisions above; ships as bluestep-tools 0.42.0,
      core-tools 0.5.0 and phi-guard 0.1.0.
   2. **Rename this repo** to the public consolidated name, archive the old core-tools repo as a
      pointer, add a `/b6p-setup` migration that rewrites each project's marketplace source, and
      delete the dormant npm CLI. Depends on 1.
   3. **The internal repo copies this layout**: one-tools moves to `plugins/one-tools/` under its
      own marketplace, with the same CI and tag scheme (no generator, Claude Code only). Depends
      on 1, not on 2. When it is live, the `one-tools` entry leaves this marketplace. One CI
      difference to plan for: the bump and release jobs here read the remote's tags with
      `git ls-remote` on a checkout without credentials, which works because this repo is public;
      the internal repo's copies need the token kept on the checkout.
   4. **History purge** of the public repo (optional, an admin runbook), any time after 2.
   5. **Split one-tools** into a public plugin and an internal one, after 1 to 3 and a
      sanitization audit. A shared public tab-guard mod is a candidate for the same phase.

   Each phase runs in its own repo's checkout, with its own spec; nothing is orchestrated across
   repos from one session, because the hooks and generator only work inside their own repo.

## Consequences

- An installed bluestep-tools sees a version bump and a smaller hook set, nothing else: plugin
  names, skill names, MCP tool names and the install cache layout are unchanged.
- Hook paths change, so Codex users re-trust bluestep-tools' hooks and trust phi-guard's. The
  0.42.0 CHANGELOG and the release email say so.
- A machine that relied on the write-time check loses it on update until phi-guard is installed;
  the canary line and `/b6p-setup` say so in the project, and the git check still runs.
- A change to one plugin releases that plugin only. A change to the generator bumps every plugin
  with `"crossTool": true`.
- The generator, CI and the hook tests walk `plugins/*`, so a new plugin needs a folder, a manifest
  with `crossTool`, and a marketplace entry; CI fails if folder name, manifest name and entry
  name disagree.
- Two files exist twice. The byte check catches drift, but an edit has to land in both.
- core-tools is not served to Cursor or Codex until the emitters carry payload folders.

## Open admin step

Whether staff machines get `phi-guard@bluestep` enabled through the organization's managed
settings is an admin decision outside this repo. It should be made before the phase 1 merge: if
it is enabled there, staff keep the write-time check across the update; if not, each machine owner
installs it when the canary or `/b6p-setup` asks. Phase 2 has a related admin check: if managed
settings set `extraKnownMarketplaces`, they need the new repo name.

## References

- Spec: `.claude/specs/multi-plugin-layout/{requirements,design,tasks}.md` (phase 1; the design's
  "Prove-out" section records the `crossTool` test)
- Spec: `.claude/specs/marketplace-rename/{requirements,design,tasks}.md` (phase 2; the record of
  its prove-out is the "Prove-out (phase 2)" section below, since the spec folder is not committed)
- Spec: `.claude/specs/internal-marketplace/` in the internal repo's checkout (phase 3; not
  committed; its record is the "Phase 3 amendment" below)
- Layout: `plugins/bluestep-tools/`, `plugins/core-tools/`, `plugins/phi-guard/`;
  marketplace `.claude-plugin/marketplace.json`; catalog [`README.md`](../../README.md)
- phi-guard: [`plugins/phi-guard/README.md`](../../plugins/phi-guard/README.md); canary nudge in
  `plugins/bluestep-tools/hooks/canary.sh`
- Shared copies: `SHARED_COPIES` in `tools/gen-cross-tool/lib.mjs`
- CI / release: `.github/workflows/ci.yml`, `.github/workflows/release-tag.yml`,
  `.github/workflows/publish.yml`

## Phase 2 amendment

Built and rolled out 2026-11-04 (PR #258, bluestep-tools 0.44.0 and core-tools 0.5.1; one-tools
0.8.0 in its own repo); the record is "Rollout (phase 2)" below. Spec:
`.claude/specs/marketplace-rename/`. The evidence for every tool-behavior claim here is the
"Prove-out (phase 2)" section that follows.

This repo becomes `Bluestep-Systems/bluestep-ai`. The marketplace stays `bluestep` and every plugin,
skill and MCP tool keeps its name (decision 4). It ships as bluestep-tools 0.44.0 and core-tools
0.5.1; phi-guard names no repo and is not bumped.

**Projects: one exception inside `project-settings`, not a new migration.** Decision 8.2 said "add
a `/b6p-setup` migration". The change is a value, not a missing key, and the `project-settings`
asset already compares a project against step 2b's block, so its Detect text (the catalogue row and
the asset) is widened instead. A `bluestep` source that names the old repo, in the
`github`/`repo` shape (`Bluestep-Systems/bspecs`) or the `git`/`url` shape
(that repo on `github.com` in the `https://`, `ssh://` or `git@…:` form, with or without `.git`
or a trailing `/`, any case), becomes
`{ "source": "github", "repo": "Bluestep-Systems/bluestep-ai" }`, keeping a `ref` or `path`;
every other key stays. It is the
one value the asset changes without asking, because the old name is the same repo; any other
differing source (a fork, a path) is still asked about. The section has its own "remove when": no
project detects it for a full release cycle. Step 2b writes the new source in new projects. Only
the project file is written. On a machine with a user-level entry the rewrite changes nothing at
run time (the user entry wins, prove-out step 4); it matters for a teammate who registers the
marketplace through the project.

**Machines: read, report, never write.** `/b6p-setup` step 1 reads the tool's own registration
through that tool's enablement reference and, when it names the old repo, prints one note under the
report's notes: nothing is needed, updates follow the rename. The optional move it names:

- Claude Code CLI and the desktop app's Code tab (same files): change the `bluestep` source in
  `~/.claude/settings.json`, then `claude plugin marketplace add Bluestep-Systems/bluestep-ai`,
  both together, because either one alone stops the plugins loading. `marketplace remove` is never
  suggested: it uninstalls the plugins and deletes their data.
- Codex: `codex plugin marketplace remove bluestep`, then
  `codex plugin marketplace add Bluestep-Systems/bluestep-ai` (plugins and hook trust are kept).
- Cursor: no check and no note; it follows the rename on restart, and a re-import would add a
  second set of folders.
- Plugins added from claude.ai for the chat side of the desktop app: not readable from a session
  and not tested.

**The old name is never reused.** Old registrations work only through GitHub's redirect. A repo
created or renamed to `Bluestep-Systems/bspecs` ends it, and every old Claude Code registration then
installs whatever that repo serves, with no warning (prove-out step 5). The org admin is told why.

**Feedback endpoint: the `bspecs` key maps to the new repo.** The endpoint builds the issue URL from
`routing.repo`, so the key is the repo name. `ALLOWED_REPOS` becomes
`["bluestep-ai", "bspecs", "b6p-cli", "web"]`, `bspecs` is sent to `bluestep-ai`, and the default
becomes `bluestep-ai`. `bspecs` stays accepted for good: every install from before this release
sends it, and `/bspecs-feedback` keeps sending it for now (switching its key is a later cleanup,
dropped only when no supported plugin version sends `bspecs`). Without the mapping, an intake would
POST to the old name and depend on GitHub's `307` (prove-out step 6). The change is published right
after this repo's rename, not before: until then `bluestep-ai` is the old core-tools repo. Whether
the GitHub App keeps the renamed repo in its scope is checked by the test intake in rollout step
3.3.

**The old core-tools repo moves aside.** It gets a pointer README (where core-tools lives now, how
to swap a `bluestep-ai` marketplace registration for `core-tools@bluestep`, and that clones must
change `origin`), is renamed `bluestep-ai-legacy` and archived, all before this repo takes the
name.

**The npm CLI is deleted** in the same change: `cli.js`, the five `src/*.js` files,
`test-scaffold.mjs`, `.npmrc` and `package-lock.json`. `package.json` is now `bluestep-ai`, private,
and keeps only `gen`, `gen:check` and `test:hooks`; CI's `validate` job installs nothing and still
checks the manifests on the Node matrix. The historic `vX.Y.Z` tags stay. The `NPM_TOKEN` secret
is deleted in the rollout; deprecating the package on the npm registry is a separate admin step.

**one-tools in the same window.** Its own PR in its own repo: its setup template writes the new
source and `/one-setup` treats the old one as the same marketplace (rewrites it, does not ask). If
it ships after this release, `/one-setup` asks about the source on each run until it does.

**Rollout order.**

1. Prove-out (done; the section below).
2. This repo's changes on a branch, PR green and **not merged**; the one-tools PR ready, not
   merged; the endpoint change ready, not published.
3. Admin, in order:
   1. Old core-tools repo: push the pointer README, rename it `bluestep-ai-legacy`, archive it.
      Repoint or delete local clones of it (from the next step on, the name `bluestep-ai` means
      this repo).
   2. Rename `bspecs` to `bluestep-ai`; set the `claude-code-plugin` topic and the description.
   3. Publish the endpoint change; send one test intake with `routing.repo = "bspecs"`; the issue
      lands in `bluestep-ai` and the triage bot runs.
   4. Managed settings (server-managed, MDM and file) and the claude.ai organization plugin
      settings, if set. **Add, do not replace:** `strictKnownMarketplaces` gets the new name next
      to the old one, and `blockedMarketplaces` must not name the new repo. A managed
      `extraKnownMarketplaces` entry **stays on the old name** for now: every machine still
      registers the old source, and an entry that differs from the registration stops the plugins
      loading (prove-out step 3, whose error names managed settings too). It moves only after the
      live check (step 5) shows a managed machine loading the plugins with both moved; the old
      name drops out of the strict list after that.
   5. Delete `NPM_TOKEN`.
4. Repoint this checkout's `origin`; merge this PR (`release-tag.yml` tags `bluestep-tools-v0.44.0`
   and `core-tools-v0.5.1`); merge and release one-tools.
5. Live check on one machine: an old-source registration still updates, in both shapes
   (`github`/`repo` and `git`/`url`); `/b6p-setup` in an existing project rewrites the source and
   reports the machine step, and the next session in that project still loads the plugins; a
   fresh `marketplace add Bluestep-Systems/bluestep-ai` lists all four plugins; Cursor and Codex
   imports from the new URL work; a desktop-app install added from claude.ai still updates (not
   covered by the prove-out); if the organization sets a managed `extraKnownMarketplaces`, one
   managed machine with it and the registration both moved loads the plugins.

Between steps 3.2 and 4, released plugins still write the old name; the redirect covers it, and
this release moves it. Merging before step 3.2 would write a source that does not exist yet.

### Rollout (phase 2)

Run 2026-11-04, in the order above.

- **3.1–3.2.** The old core-tools repo got its pointer README, was renamed `bluestep-ai-legacy`
  and archived. Then this repo was renamed `bluestep-ai`, with its topic and description. The old
  name serves the same `main` through the redirect.
- **3.3.** The endpoint was published. The live endpoint sends requests with
  `followRedirects: false`, so between the rename and the publish an intake would fail at the
  GitHub step; publish right after the rename. A test intake with `routing.repo = "bspecs"`
  opened its issue on `bluestep-ai`. The triage bot run for it failed, as every run has since
  2026-10-23; that is unrelated to the rename and tracked on its own.
- **3.4–3.5.** The admin reported managed settings handled (not readable from a session).
  `NPM_TOKEN` is deleted.
- **4.** `origin` was repointed, PR #258 merged, and the `bluestep-tools-v0.44.0` and
  `core-tools-v0.5.1` tags were cut. The one-tools PR merged as 0.8.0.
- **5. Live check.**
  - Claude Code, a `git`/`url` registration on the old name: `marketplace update` and
    `plugin update` brought 0.44.0, core-tools 0.5.1 and one-tools 0.8.0.
  - Claude Code, a scratch `github`/`repo` registration on the old name: add, install and update
    reached 0.44.0. A fresh add of the new name lists all four plugins.
  - Codex, a scratch add of the new URL: works and serves all three manifests.
  - `/b6p-setup` in an existing project:
    - it rewrote the source without asking, changing that one value;
    - it printed the machine note and wrote no machine file;
    - the next session loaded 0.44.0, and `marketplace update` from that folder works;
    - the project's debug log shows the reconcile error from prove-out step 4. It was already
      there before the rewrite, because the project and user entries were in different shapes.
  - Cursor:
    - a new import from the `bluestep-ai` URL serves 0.44.0;
    - this machine's older copies were frozen at commits from 2026-11-02, before the rename and
      before 0.42.0, so they did not show whether an old import follows the rename;
    - that case rests on prove-out step 8.
  - NOT OBSERVED:
    - an existing Cursor import of the old URL updating;
    - an existing Codex registration upgrading;
    - a desktop-app install added from claude.ai;
    - a managed machine.

## Prove-out (phase 2)

Recorded 2026-11-03 from tasks 1 and 2 of `.claude/specs/marketplace-rename/`: Claude Code CLI,
Codex CLI and the GitHub API in task 1; Cursor and the desktop app in task 2 (step 8).

**Setup.** Claude Code 2.1.316; Codex CLI 0.166.0-alpha.5.1 (the copy bundled with the Codex desktop
app); gh 2.101.0; git 2.52.0; Windows 11. Three throwaway public repos under a personal GitHub
account: A (renamed to B), C (later renamed into A's freed name), D. Each held a
`.claude-plugin/marketplace.json`, a Codex `.agents/plugins/marketplace.json` and one plugin with a
trivial skill and, for Codex, a trivial `PreToolUse` hook. Scratch profiles through
`CLAUDE_CONFIG_DIR` and `CODEX_HOME`: plugin and marketplace commands work there without a login,
`claude -p` does not. Codex hook trust was read and set through its app-server (`hooks/list`,
`config/batchWrite`), the calls its own UI makes.

**1. Claude Code update after a rename.** Registered A in both shapes (`marketplace add owner/a`
stores `github`/`repo` and clones over SSH; `add https://github.com/owner/a.git` stores
`git`/`url`), installed the plugin, renamed A to B, pushed a new commit to B.
`claude plugin marketplace update <name>` printed "Successfully updated marketplace" and the clone
held the new commit, in both shapes; a later version bump came through `claude plugin update`
("updated from 0.1.0 to 0.1.1"). Every file keeps the old name: `known_marketplaces.json`,
`extraKnownMarketplaces` in `settings.json`, and the clone's `origin`. A fresh `marketplace add` of
the old name also works.

**2. Codex update after a rename.** `codex plugin marketplace add` (the `owner/repo` form stores
the same `https://…/a.git` URL), `codex plugin add`, hook trusted, renamed.
`codex plugin marketplace upgrade <name>` printed "Upgraded marketplace … to the latest configured
revision" with the new commit; `config.toml` and the clone's `origin` kept the old URL. Re-trust:
after a README-only commit the hook stayed `trusted`. After a version bump with the hook untouched,
`upgrade` also moved the installed plugin to the new version and the hook became `modified`: the
trust entry stores `trusted_hash` (the hook definition, unchanged) and `trusted_content_hash`
(changed). So the source change asks for nothing; any release that changes the plugin's content
asks for re-trust.

**3. Adding the new name under the same marketplace name.**

- Claude Code: `claude plugin marketplace add owner/b` is refused: "Cannot add marketplace …: its
  source doesn't match its extraKnownMarketplaces entry in user or managed settings; add it from
  the source that entry lists, or change the entry." Nothing changes.
- Claude Code, in place: change the entry's `source` in `~/.claude/settings.json` to the new repo,
  then run the same `marketplace add <new>`. It re-clones from the new name, both files and
  `origin` move, and the plugin stays installed and enabled. Both halves are needed: with only the
  edit (or only the registration moved), `claude plugin list` shows "✘ failed to load — Marketplace
  … is added but ignored. Its source doesn't match its extraKnownMarketplaces entry …".
- Claude Code: `claude plugin marketplace remove` "also uninstalled 1 plugin … deletes their saved
  options, secrets and data"; add plus install afterwards is a reinstall.
- Codex: `codex plugin marketplace add <new>` is refused: "already added from a different source;
  remove it before adding this source". `codex plugin marketplace remove <name>` then
  `add <new>` keeps the `[plugins."…"]` entry, the plugin cache and the hook trust: the plugin
  stays installed and its hook stays trusted. Editing `source` in `config.toml` and running
  `upgrade` does the same.

**4. Project source differs from the user's.** In scratch profiles, with the user entry on the old
name and a trusted project declaring the new one (the `github`/`repo` shape `/b6p-setup` writes),
`marketplace list`, `plugin list` and `marketplace update` all use the user's registration; the
reverse case is the same. At session start Claude Code plans a reconcile: the `claude -p` debug
log shows `[reconcile] 1 marketplace(s): <name>(update)` whenever the project's source differs in
any way (the same repo in the other shape too) and nothing when it matches exactly. Scratch runs
stop at "Not logged in" before the update runs. The outcome is in this machine's own debug logs
(read only): in a trusted B6P project whose source is `github`/`Bluestep-Systems/bspecs` while the
user entry is `git`/`…/bspecs.git`, each session logs `bluestep(update)` and then
`[ERROR] [reconcile] failed to update marketplace 'bluestep': Cannot add marketplace "bluestep": its
source doesn't match its extraKnownMarketplaces entry in user or managed settings…`. The
registration stays as it was and the plugins load. So the user entry wins, nobody is asked, the
clone does not flip between projects, and the only trace is that debug line.
NOT OBSERVED end to end with a different repo name in the project (the same reject is expected,
since the plan is the same "update"): it needs a logged-in scratch profile, one interactive
`/login` under the scratch `CLAUDE_CONFIG_DIR`. NOT OBSERVED either: a machine that registered the
marketplace only through a project and has no user entry, where the reconcile might re-point it.
A logged-in fallback in the real profile (local scope in a scratch folder) could not stand in:
local scope outranks project scope, and that untrusted folder ran no reconcile.

**5. Renaming into a name that redirects.** `gh repo rename <A's old name> --repo <owner>/c`
succeeded. The old name now serves C (`git ls-remote` returns C's commit) and B lost that redirect.
Registrations still on that name: Claude Code's `marketplace update` printed "Successfully updated",
the clone held C's marketplace (a different marketplace name), and `claude plugin update` went
"from 0.1.1 to 0.1.0" with C's plugin, with no warning. Codex refused: "upgraded marketplace name
`…-c` does not match configured marketplace `…`", and the plugin stayed as it was.

**6. API POST to the old name** (run before step 5; a personal OAuth token through `gh` stands in
for the App token). The raw response is `307 Temporary Redirect`, `Location:
https://api.github.com/repositories/<id>/issues`; `gh api` follows it and gets `201 Created`, with
the issue in B. A client that does not follow a 307 on POST opens nothing.

**7. A registered URL starts serving another marketplace name.** D registered as `mrp-x`, then its
`marketplace.json` renamed to `bluestep-like-other`.

- Claude Code: `marketplace update mrp-x` printed "Successfully updated". The registration keeps
  the name `mrp-x`, the plugin stays `…@mrp-x` and loads, the clone moves to a folder named after
  the new name and the old folder stays behind. `install …@bluestep-like-other` is "not found";
  `marketplace add <D's URL>` says "Marketplace 'mrp-x' already on disk". The user sees nothing.
- Claude Code, when the new name is already registered from another repo: `marketplace update`
  (all) prints "1 marketplace could not be refreshed (see --debug)" and "Updated 2 marketplaces,
  but not all"; both plugins keep loading.
- Codex: `upgrade` fails with "upgraded marketplace name `bluestep-like-other` does not match
  configured marketplace `mrp-x`"; the plugin stays.
- For the old core-tools repo's users: on Claude Code their registration silently serves the
  `bluestep` catalog under its old name (or reports a refresh failure if `bluestep` is also
  registered); on Codex its upgrade fails with the name error. The pointer README tells them to
  remove that marketplace and install from `bluestep`.

**Chosen step per tool.**

- **Claude Code CLI: nothing.** Updates follow the redirect, and a project on the new name does
  not override the user's registration. A later move is optional and is not one command: change
  the `bluestep` source in `~/.claude/settings.json` to `Bluestep-Systems/bluestep-ai`, then
  `claude plugin marketplace add Bluestep-Systems/bluestep-ai`. Plugins stay installed. Doing only
  one half stops them loading. `remove` plus `add` is a reinstall that deletes plugin data and is
  never suggested.
- **Codex: nothing.** A later move is optional: `codex plugin marketplace remove bluestep`, then
  `codex plugin marketplace add Bluestep-Systems/bluestep-ai`. Plugins stay installed and hooks
  stay trusted.
- Both depend on the redirect. Anything that later takes the name `Bluestep-Systems/bspecs` is
  served to every old Claude Code registration with no warning (step 5).

**8. Cursor and the desktop app** (task 2, with a person at the keyboard).

- Cursor (Windows): imported a throwaway Cursor marketplace with Import from Repo and installed
  its plugin (0.1.0). Cursor keeps the import under
  `~/.cursor/plugins/marketplaces/github.com/<owner>/<repo>/<commit>/` and the installed plugin
  under `~/.cursor/plugins/cache/<owner>-<repo>/<plugin>/<commit>/`, both named after the repo.
  Renamed the repo and pushed 0.1.1. After a restart Cursor updated by itself: the plugin page shows
  0.1.1, the folders kept the old repo name with only the new commit inside, and no second copy
  appeared. The skill text on disk was the new one; the plugin page still showed the old skill
  description until it was opened again (display cache).
- Desktop app, Code tab: the session runs with `CLAUDE_CODE_ENTRYPOINT=claude-desktop` and no
  `CLAUDE_CONFIG_DIR`, and its installed plugins are the ones in `~/.claude/plugins`. So it reads the
  same `known_marketplaces.json` and `settings.json` as the CLI, and steps 1, 3 and 4 apply as they
  are. NOT OBSERVED: plugins added from claude.ai (Customize → Plugins) for the chat side of the
  app, which are kept on the account; whether their source follows the redirect needs a test on a
  claude.ai account.

- **Cursor: nothing.** It follows the redirect on restart and keeps its folders. A later move is
  re-importing from the new URL, which creates a second set of folders; not suggested.
- **Desktop app (Code tab): same as the Claude Code CLI.**

## Phase 3 amendment

Built and rolled out 2026-11-05. one-tools now lives in `plugins/one-tools/` of the private
`Bluestep-Systems/bluestep-ai-internal` repo (named `Bluestep-Systems/one-tools` until the rename
below), which is the **`bluestep-internal`** marketplace, and this
marketplace no longer lists it. Spec: `.claude/specs/internal-marketplace/` in that repo's checkout
(not committed); this section is its record.

**Picks.**

- **The internal repo is `Bluestep-Systems/one-tools`, restructured in place and not renamed.**
  Every project's one-tools config, the install instructions, clones and the access list already
  name it, so nothing goes through a redirect. A rename stays possible later, with phase 2's rule
  that an old name is never reused.
  **Amended 2026-11-05: renamed to `Bluestep-Systems/bluestep-ai-internal` the same day.** With a
  handful of users the redirect cost is small, and the name now matches the public repo and can
  hold other internal plugins (phase 5). The marketplace name and the plugin id did not change.
  The old URL redirects: `git ls-remote` on it and `claude plugin marketplace update
  bluestep-internal` on a machine registered with it both worked. one-tools 0.12.0 names the new
  repo and has `/one-setup` move a project's marketplace source off the old name, the same rule as
  the `bluestep` move. `Bluestep-Systems/one-tools` is never to be reused.
- **The marketplace is `bluestep-internal`**; the plugin id is `one-tools@bluestep-internal`. The
  plugin keeps its name (decision 4).
- **Same layout and release scheme as here** (decision 3): `plugins/<name>/`, a root catalog README,
  per-plugin CHANGELOG and version, `<name>-v<version>` tags and Releases cut by a copy of
  `release-tag.yml` on merge. No generator, no Cursor or Codex output.
- **CI in a private repo.** The version-bump job keeps the job's read-only token on its checkout so
  `git ls-remote --tags origin` works (here it runs without credentials because this repo is
  public); `release-tag.yml` already kept it. The organization's GitHub plan cannot make checks
  required on a private repo, so there the checks are advisory and the rule is "merge on green".
  The internal CI also rejects files at the plugin's old root paths, for drafts sent by an older
  `/contribute`.
- **Moving installs: pin, restructure, bridge, move, remove.** This entry was first pinned to the
  last root-layout commit (#261), the internal repo was restructured (one-tools 0.10.0), and this
  entry was then switched to a `git-subdir` source on `plugins/one-tools/` (#262), so
  `one-tools@bluestep` kept updating with the same releases while users moved. one-tools 0.11.0
  shipped the move: `/one-setup` reports which copy a machine has and hands over the commands
  (`marketplace add` of the internal repo's HTTPS URL, `install one-tools@bluestep-internal`,
  `uninstall one-tools@bluestep`, a new session); it writes the internal marketplace into a
  project's `extraKnownMarketplaces` and renames an `enabledPlugins` key naming the old id. It
  never writes a machine file. `/b6p-setup` is unchanged: it never named one-tools.
- **Removal after every user moved.** one-tools had a handful of staff users; they moved together and this entry
  was removed the same day (this change), with no fixed waiting period.

**Prove-out** (Claude Code 2.1.317, scratch `CLAUDE_CONFIG_DIR` profiles, a throwaway branch of the
internal repo; HTTPS-only runs used environment-only git config with the SSH key excluded):

1. A `github` plugin source clones **over SSH only**: with no usable SSH key it fails with
   "Permission denied (publickey)" and does not try HTTPS. A `git-subdir` source with a full
   `https://` URL installs and updates with HTTPS credentials alone (its `owner/repo` shorthand
   would use SSH). So the bridge used the full URL, and machines set up only for SSH needed
   `gh auth setup-git`; on Git for Windows that helper is written with an empty first value, which
   skips Git Credential Manager's sign-in window.
2. The installed version comes from the plugin's manifest, not the source's commit. An unpinned
   `github` source on a commit whose root holds no `plugin.json` installs an enabled plugin with
   nothing in it, at a commit-hash version; hence the pin before the restructure.
3. Switching an existing install's entry from `github` + `sha` to `git-subdir` + `ref` updates it
   normally. `git-subdir` + `sha` holds an install still, so it is the rollback shape once the
   repo is restructured.
4. Two installed copies of one plugin from two marketplaces: a session loads **one** (the earlier
   source); the other's hooks and hooks module are skipped ("Skipping duplicate hook registration
   … already registered from another source").
5. **Removing a plugin's entry does not freeze it.** After the marketplace updates, the plugin
   stays in `installed_plugins.json` but shows "failed to load — Plugin … not found in
   marketplace" and no skill, hook or module of it loads. Putting the entry back makes it load
   again. Nothing is deleted.
6. A project's `extraKnownMarketplaces` entry for a marketplace the machine lacks is registered at
   session start in a **trusted** folder (`[reconcile] … (install)`), in exactly the project's
   source shape, with nothing written to the user's settings; an untrusted folder does nothing.
   A later `marketplace add` of the same value answers "already on disk" and declares it in the
   user's settings, where a marketplace's `autoUpdate` lives (project and local values are
   ignored; there is no CLI flag for it).
7. Uninstalling one id leaves the other marketplace and its plugins alone; the remaining copy's
   hooks module loads with no new approval.
8. `--plugin-dir <path>` loads a checkout over an installed copy ("overrides installed version");
   a wrong path is skipped with only a warning in `--debug`.
9. The desktop app's chat side (Customize › Plugins) cannot add the private marketplace until
   *Connect GitHub* is used there; its Code tab uses the same install as the CLI.

**Rollout.**

1. #261 (pin) merged; `one-tools@bluestep` stayed at 0.9.0.
2. The internal restructure merged; its CI cut `one-tools-v0.10.0` and a Release (the tag push and
   `ls-remote` work on the private repo with the kept token).
3. #262 (bridge) merged about two minutes after #261; `one-tools@bluestep` updated to 0.10.0 from
   `plugins/one-tools/` and a session loaded it. #262 was stacked on #261's branch and had to be
   retargeted to `main` by hand.
4. one-tools 0.11.0 (the move release) merged and tagged; both ids updated to it.
5. Live check on the maintainer's machine: the move commands left one copy
   (`one-tools@bluestep-internal`), bluestep-tools and core-tools untouched, and a new session
   loaded it. In a conversion workspace that enabled the old id at project scope, `/one-setup`
   reported the project-scope copy and its uninstall; the user-scope copy had already won there
   (point 4). `/one-setup`'s writes to `.claude/settings.json` need the user's approval: a
   `claude -p` session cannot make them, even with `acceptEdits`.
6. The other users moved; this entry was removed (this change).

**NOT OBSERVED.**

- A machine whose one-tools comes from managed settings (the uninstall is refused there; the
  organization's admin moves it).
- The desktop app's chat side past *Connect GitHub*.
- What `autoUpdate` defaults to when no value is set, on the CLI.
- How a plugin skill is named in `skillOverrides` (relevant to a later one-tools change).