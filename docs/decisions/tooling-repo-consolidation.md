# ADR: One tooling repo per visibility, several plugins per repo

**Status:** Accepted (2026-11-03). Phase 1 is built in this repo. Phase 2 is built, rollout
pending (see "Phase 2 amendment"). Phases 3 to 5 are planned.

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
- Layout: `plugins/bluestep-tools/`, `plugins/core-tools/`, `plugins/phi-guard/`;
  marketplace `.claude-plugin/marketplace.json`; catalog [`README.md`](../../README.md)
- phi-guard: [`plugins/phi-guard/README.md`](../../plugins/phi-guard/README.md); canary nudge in
  `plugins/bluestep-tools/hooks/canary.sh`
- Shared copies: `SHARED_COPIES` in `tools/gen-cross-tool/lib.mjs`
- CI / release: `.github/workflows/ci.yml`, `.github/workflows/release-tag.yml`,
  `.github/workflows/publish.yml`

## Phase 2 amendment

Built 2026-11-04 on a branch; **rollout pending** (the two renames, the endpoint publish and the
admin steps below have not run). Spec: `.claude/specs/marketplace-rename/`. The evidence for every
tool-behavior claim here is the "Prove-out (phase 2)" section that follows.

This repo becomes `Bluestep-Systems/bluestep-ai`. The marketplace stays `bluestep` and every plugin,
skill and MCP tool keeps its name (decision 4). It ships as bluestep-tools 0.44.0 and core-tools
0.5.1; phi-guard names no repo and is not bumped.

**Projects: one exception inside `project-settings`, not a new migration.** Decision 8.2 said "add
a `/b6p-setup` migration". The change is a value, not a missing key, and the `project-settings`
asset already compares a project against step 2b's block, so its Detect text (the catalogue row and
the asset) is widened instead. A `bluestep` source that names the old repo, in the
`github`/`repo` shape (`Bluestep-Systems/bspecs`) or the `git`/`url` shape
(`github.com/Bluestep-Systems/bspecs`, with or without `.git`, any case), becomes
`{ "source": "github", "repo": "Bluestep-Systems/bluestep-ai" }`; every other key stays. It is the
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
it ships after this release, `/one-setup` asks once per project until it does.

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
   4. Managed settings (`extraKnownMarketplaces`, `strictKnownMarketplaces`,
      `blockedMarketplaces`; server-managed, MDM and file) and the claude.ai organization plugin
      settings, each moved to the new name if set. A managed entry overrides the project's, and
      under `strictKnownMarketplaces` a plugin whose source no longer matches does not load, so
      this comes before the merge.
   5. Delete `NPM_TOKEN`.
4. Repoint this checkout's `origin`; merge this PR (`release-tag.yml` tags `bluestep-tools-v0.44.0`
   and `core-tools-v0.5.1`); merge and release one-tools.
5. Live check on one machine: an old-source registration still updates; `/b6p-setup` in an
   existing project rewrites the source and reports the machine step; a fresh
   `marketplace add Bluestep-Systems/bluestep-ai` lists all four plugins; Cursor and Codex imports
   from the new URL work.

Between steps 3.2 and 4, released plugins still write the old name; the redirect covers it, and
this release moves it. Merging before step 3.2 would write a source that does not exist yet. When
step 5 passes, this section and the status line say phase 2 is done.

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
