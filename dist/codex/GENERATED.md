# Generated tree — do not edit

Everything under `dist/codex/` is generated from `plugin/**` by
`tools/gen-cross-tool` (the Codex emitter). Never hand-edit these files:
the generator wipes and rewrites this whole tree on every run, so edits here
are lost — edit the source under `plugin/` instead and regenerate with:

    npm run gen
