// Dev stub. When running from source (`node cli.js`) no templates are embedded,
// so the template readers in utils.js fall back to reading templates/ from disk.
//
// At binary-build time the esbuild step (scripts/build-binary.mjs) replaces this
// module — via an onLoad plugin — with a generated one that returns the entire
// template tree as an in-memory map: forward-slashed path relative to templates/
// (e.g. 'claude/skills/b6p-pull/SKILL.md') -> file contents. That lets the
// self-contained SEA scaffold with no on-disk templates/ dir. Same
// build-time-bake + dev-fallback shape as src/version.js (tasks A1 / A2.5).
//
// Returns null in dev (disk fallback); the embedded object when baked into a binary.
export function getEmbeddedTemplates() {
  return null;
}
