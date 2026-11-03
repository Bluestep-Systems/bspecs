# Where each tool records the projects it has opened

`all` mode needs a list of directories the user works in. Every supported tool keeps one, but in a
different place and shape. Read the section for the tool you are running in; skip the others.

These are **internal stores belonging to the editor, not documented interfaces**. Open them
**read-only** and never write to them — they are live state the tool owns, and a corrupted one costs
the user their window layout or their session history. Where the store is missing, locked, or shaped
differently from what is described here (a tool version moved it), say so in one line and fall back
to `here` plus the subfolder scan. Do not guess at a new location.

None of these lists is authoritative about what exists on disk: they record what was *opened*, so
always `test -d` each path and always union with the subfolder scan of the session root.

## Claude Code

`~/.claude.json`, the `projects` object. Its keys are directory paths; take the keys only — the
values hold that project's own history, which is none of this skill's business.

The strongest of the three: unbounded, and it holds every directory ever opened. Its quirk is
**duplicate spellings of one directory** — drive-letter case (`C:/…` and `c:/…`), separator style
(`/` and `\`), and UNC versus `wsl:` prefixes for the same network path. A real index here held 45
keys for roughly half that many directories, so normalise before reporting or the user sees one
project listed three times and reads it as three projects to fix.

## Cursor

The Electron global storage database, `state.vscdb`, under the Cursor user-data directory
(`%APPDATA%\Cursor\User\globalStorage\` on Windows, `~/Library/Application Support/Cursor/User/globalStorage/`
on macOS, `~/.config/Cursor/User/globalStorage/` on Linux). It is SQLite: read the `value` of the row
in `ItemTable` whose `key` is `history.recentlyOpenedPathsList`, and parse it as JSON.

Open it with a read-only connection (a `file:…?mode=ro` URI, or copy the file first). Cursor may be
running, and its write-ahead-log companions (`-wal`, `-shm`) mean a naive writer can corrupt it.

Two things make this a **weaker** index than Claude Code's:

- It is a **recently-opened list**, so it is short — a live one held four entries — and a project the
  user has not touched lately is simply absent.
- Its `entries` mix folders and single files. Keep the ones carrying a folder path; drop file entries.

Paths arrive as percent-encoded `file://` URIs with an encoded drive colon (`file:///c%3A/Users/…`),
so decode before comparing or `test -d`.

Because the list is short, the subfolder scan carries most of the weight on Cursor. Say plainly that
`all` there covers recently-opened projects rather than every project, so the user knows to run
`here` in anything the sweep missed.

## Codex

Session rollout files under `~/.codex/sessions/`, laid out by date
(`~/.codex/sessions/<YYYY>/<MM>/<DD>/rollout-*.jsonl`). Each file's **first** record is a
`session_meta` whose `payload.cwd` is the directory that session ran in.

Read only that first line of each file — the rest of a rollout is the whole transcript, and reading
those would cost far more than the answer is worth. The sibling `session_index.jsonl` looks like the
obvious place to check but carries only session ids, names and timestamps, no path.

One directory appears once per session, so **dedupe** heavily. The list reaches back as far as the
user's retained sessions and no further.
