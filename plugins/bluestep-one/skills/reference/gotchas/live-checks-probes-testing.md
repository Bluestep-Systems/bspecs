# Gotchas — live checks and probes

Prefix `G`.

---

### G-168 — A component repo's `.scratch/` is neither tracked nor ignored, so one `git add .` sends probe scripts and drafts to the platform

What looks right: helper files kept in a dot folder stay local. What happens: a component repo's
remote is the platform's own git, its `.gitignore` lists only `/types/`, `/node_modules/` and the
package files, and `.git/info/exclude` may list only `types`. So a `.scratch/` folder (probe
scripts that write to the org, edit scripts, commit messages, notes) shows as untracked. A
`git add .` or `git add -A` commits it into `draft`, and the next build carries it.

**How to tell.** `git -C <component repo> status --short` shows `?? .scratch/`, and
`.git/info/exclude` does not list it.

What to do: when a component repo is set up, add `.scratch/` to its `.git/info/exclude` (local,
never pushed), and stage files by name.

**Applies to:** any BlueStep One component
