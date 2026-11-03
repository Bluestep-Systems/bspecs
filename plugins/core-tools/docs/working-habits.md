# Working habits

What a person does to keep agent sessions cheap and sharp. The model has its own rules file; this
page is only the things no setting or script can do for you. One screen. If it grows, cut it.

## Session boundaries

- **One task per session.** New unrelated task: write the handoff into the task file, then `/clear`.
  Why: a fresh session with a focused prompt beats a long one carrying leftovers.
- **`/clear` between tasks; let auto-compaction handle growth inside a task.** The 400 K cap is a
  setting, not something you watch. Why: `/clear` costs nothing; compaction during work runs warm
  and is cheap.
- **Never `/compact` right after a long break.** Compact before stepping away, or `/clear` when you
  come back. Why: after the cache expires, compaction re-reads the whole history uncached. This is
  the most expensive thing you can do to a session.
- **`/compact <focus>` before a big new step, if you compact at all.** Why: you keep what you choose
  instead of what the automatic pass guesses.

## Steering

- **Pick the model and effort level at the start, not partway through.** Why: each model has its own
  cache, so a switch re-reads the whole conversation (about 30x the write of staying put).
- **`/rewind` instead of `/compact` when abandoning an approach.** Why: rewind goes back to a prefix
  that is already cached; compaction builds a new one.
- **After two failed corrections, `/clear` and rewrite the prompt.** Why: a clean session with a
  better prompt almost always outperforms a long session of accumulated corrections.
- **Write decisions into the task file as you make them.** Why: they outlive the session and the
  next one does not have to reopen a 400 K transcript to recover them.
- **Ask for a screenshot only when the question is visual.** Why: each one is about 164 KB, and
  when images pass the request limit a batch is dropped and the conversation is reprocessed.
- **Check rule-file edits in a fresh session.** Why: edits to CLAUDE.md or AGENTS.md do nothing until
  `/clear`, `/compact` or a restart.

## What not to bother with (measured, 30 days to 2026-09-09)

- **No cache-warming pings.** 99.4% of requests already arrive inside the cache TTL.
- **Do not change `promptCacheTtl`.** The main conversation wrote zero five-minute cache tokens; all
  writes were already 1 h. There was no TTL drop to fix. The 1 h write rate (2x base vs 1.25x) pays
  off at about 2 avoided misses per session; we see 0.24.
- **Subagents do use the 5 m TTL** (17.4 M tokens). `subagentPromptCacheTtl: "1h"` is the only knob
  the data points at, and only worth trying if `/usage` shows subagent cache misses. Not seen yet.

Full reasoning: the `agent-workflow-efficiency` design in the `code` workspace, § 5, § 5.5, § 6.5.
