# The seven BlueStep One types, and a component repo's setup

Load when setting up a component repo, when a type error says the host lost a member, or before
any publish.

## The types

A component's types are seven `.d.ts` files the running tenant generates and serves at
`https://<one.host>/one/<name>.d.ts`: `component-host`, `form-kit`, `ui`, `ui.primitives`,
`ui.structural`, `ui.tokens`, `ui.icons`. They are downloaded, never committed and never edited
(the project's settings deny `Edit(types/**)`): the next download overwrites them.

- **Download all seven before every publish**, with
  `node "${CLAUDE_PLUGIN_ROOT}/tools/fetch-types.mjs" --out <shared types folder>`. The host comes
  from `one.host` in `.claude/bluestep-one.json`. One shared folder beside the component repos serves them all.
- **Every file is checked** by the script: it opens with a `/**` comment carrying `GENERATED`, and
  has a top-level `export`. A wrong path answers **200 with the app's `index.html`**, and because
  `skipLibCheck` is on, that would turn into silent `any`. Never grep the body for `<html`: the ui
  types mention `HTMLElement`.
- **A type error that says the host lost a member means your copy is stale.** Re-download before
  debugging it: the contract moves and carries no version stamp. A refresh that *introduces* errors
  is real news; one that clears them was drift.

## A new component repo

The platform's scaffold is not ready to build on (one commit, *Scaffold component*, already on
`draft`): its `tsconfig.json` maps only `#component-host`, its `component.json` has a sample
`title` prop, its `Component.tsx` renders that title, and its README is the platform's guide.

Before any of this, the component must exist. The user creates it, by hand, on the BlueStep One
host (`one.host`): the *Build* panel › *Create component*. No tool can make one for the agent. The
new row shows *no repo* until the component is opened. Then its id (the `<n>___<n>` the list
shows) goes into `.claude/bluestep-one.json` › `components` as `{ "id", "name", "repo" }`, or
`/bluestep-one:build` stops. The agent builds and publishes only these ids, and the tab guard lets
no other through without asking.

Then:

1. The clone URL is on the component's *Settings* › *Source*. The git host is
   `one.gitHost`, which may differ from `one.host`. Clone with
   `GIT_TERMINAL_PROMPT=0 GCM_INTERACTIVE=never git clone <url>`, so git fails at once instead of
   opening a login window that hangs the run. "could not read Username" means no login is saved
   for the git host yet: hand over `git ls-remote <url>` for the user to run in their own
   terminal. Git asks for a username and password (on Windows, in a *Git Credential Manager*
   window); the user types their own BlueStep login on `one.gitHost` (a `b6pt_` token also
   works as the password), and it is saved for every later clone, fetch and push. Never ask for it
   in chat. Then clone again. A 403, or a 404 on a component that exists, means that login cannot
   read the component: ask whoever administers the org for access to it.
2. `git checkout draft`.
3. Copy `${CLAUDE_PLUGIN_ROOT}/templates/component/tsconfig.json` over the scaffold's, and
   `templates/component/.gitignore` if the scaffold's differs.
4. Replace `component.json`, `Component.tsx` and the README with the component's own.
5. Link `types` to the shared folder. On Windows `ln -s` makes a plain file, so use a junction:
   `powershell -NoProfile -Command "New-Item -ItemType Junction -Path <repo>\types -Target <shared>\types"`.
   Elsewhere `ln -s ../types types`.
6. Add `types` and `.scratch/` to the repo's `.git/info/exclude` (local, never pushed). The remote
   is the platform's own git, so one `git add .` would otherwise send probe scripts and drafts to
   the build. Stage files by name.
7. **A component repo declares no dependencies**; the build refuses any repo that does. Editor
   tooling goes in a gitignored `package.json`:
   `npm i -D typescript@'>=7' @types/react@19 @types/react-dom@19`.
