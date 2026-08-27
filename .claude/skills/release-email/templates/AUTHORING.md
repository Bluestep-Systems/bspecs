# Authoring notes — `email.html`

`email.html` is the send body for the `/release-email` skill. The skill fills its placeholders,
clones the per-product section block once per product that changed, and POSTs the finished HTML to
the BlueHQ send endpoint. See the setup guide
[`docs/bluehq-release-email-endpoint-setup.md`](../../../../docs/bluehq-release-email-endpoint-setup.md)
and the ADR [`docs/decisions/release-update-email.md`](../../../../docs/decisions/release-update-email.md).

## The committed file is hand-edited HTML — and stays that way

`email.html` is plain, hand-editable HTML. Edit it directly. There is **no build step in this repo**:
nothing about this template goes in `package.json`, no lockfile change, no `node_modules`, no CI
task. Only the built `.html` is tracked.

If you want a tool to help while authoring (e.g. MJML to generate table markup, `juice` to inline a
`<style>` block, or a formatter), install it **locally only** — a throwaway global install or a
scratch dir outside the repo — and paste the hand-cleaned result back into `email.html`. Do not add
it as a dependency and do not commit any generated intermediate (`.mjml` source, lockfiles, etc.).
The source of truth is the committed `.html`, not a toolchain someone else would have to reproduce.

## Placeholder tokens

The skill substitutes these; a human editor should leave them as literal tokens.

| Token | Where | What it is |
| --- | --- | --- |
| `[SUBJECT]` | HTML comment on line 1 + `<title>` | The subject line. The `<!-- SUBJECT: ... -->` comment carries it so the template stays self-describing; the skill reads it and sends it as the real subject. |
| `[LOGO_URL]` | header + footer `<img src>` | Absolute URL of the **hosted PNG** logo. Set once per the setup guide (section 4). Email clients can't render an SVG or a repo-relative path, so this is always an absolute `https://` URL. |
| `[OVERLINE]` | header kicker | Short uppercase label above the intro. Varies per run — e.g. `Plugin update`, `CLI update`, or `Tooling update` when a run covers both. The skill sets it; don't hardcode a product here. |
| `[RELEASE_URL]` | "Full release notes" link | Link to the full release-notes page. |
| `[RECIPIENT]` | footer opt-out line | The recipient's address. **Merged per recipient on the endpoint** — never bake a real (or fabricated) address into the committed file. |
| `[OPT_OUT]` | footer unsubscribe link | The opt-out / unsubscribe URL. Also merged on the endpoint. |
| `[PRODUCT_NAME]` | section heading | The product a section is about (e.g. `bluestep-tools plugin`, `b6p CLI`). |
| `[UPDATE_INSTRUCTION]` | section update chip | That product's update command in the code chip (plugin: `/plugin marketplace update`; CLI: the b6p-cli update command). |

Marked regions (comment pairs, not single tokens):

- `<!-- INTRO -->` — the greeting/lead prose the skill writes. A short sample sits inside so the
  layout reads; the skill replaces the sample paragraphs.
- `<!-- PRODUCT_SECTION:START -->` … `<!-- PRODUCT_SECTION:END -->` — the **repeatable unit**. The
  skill clones the whole block once per product that has changes and drops products with none.
- `<!-- ENTRIES:START -->` … `<!-- ENTRIES:END -->` — the changelog rows inside one section. The
  skill clones one row (version cell + text cell) per entry.

## Email-safe constraints — do not break these

Email clients (Outlook's Word engine especially) drop or mangle modern CSS. A future edit must keep
the file sendable:

- **Table-based layout only.** Every row and column is a `<table role="presentation">` with
  `cellpadding`/`cellspacing="0"` and `border="0"`. **No** `display:flex`, **no** CSS grid, **no**
  `gap` — those were in the design canvas and must not come back.
- **Inline styles carry the layout.** Every layout style lives inline on its element. The `<style>`
  block in `<head>` is progressive enhancement only (link colors + a mobile `@media`); the design
  must still hold if a client strips it entirely.
- **Hosted PNG logo, not SVG.** The logo is an `<img src="[LOGO_URL]">` with explicit `width`/
  `height`, `alt="BlueStep"`, and `display:block`. Keep the "Blue**Step**" wordmark next to it (Blue
  bold + Step regular, brand blue `#0063A6`). No inline SVG, no icon fonts, no emoji.
- **Fallback fonts must carry the design.** Email clients won't load webfonts. Lato falls back to
  `'Helvetica Neue', Arial, sans-serif`; Merriweather (display headings) to
  `Georgia, 'Times New Roman', serif`; code to `Consolas, Menlo, monospace`. Author for the
  fallback, not the webfont.
- **~600px, centered, single-column.** A full-width background table centers a 600px container
  (with an MSO ghost-table wrapper for Outlook). The `@media` block makes it fluid on small screens.
- **Define link colors inline.** Add link colors inline on every `<a>` (and in the head `<style>`
  as a fallback) so clients don't fall back to default blue/underline.

## Brand tokens (reference)

Brand blue `#0063A6`; dark blue `#004f86`; blue tints `#eef6fb`, `#d4e7f4`, `#7db6dd`; warm
near-black `#231F20`; greys `#5b6264`, `#767e80`, `#969FA0`; rules `#e6e9ea`; code-chip bg
`#f1f3f3`; page bg `#FFFFFF`; brand yellow `#FFC629` (Pantone 123 — the one warm accent, used
sparingly). Fonts: body Lato, display Merriweather, code Consolas — each with the fallback stack
above.

## Optional blocks (the skill drops these in as needed)

The template shell is intentionally minimal. When a release needs more than the standard product
sections, the skill copies one of these **email-safe** blocks in at the right spot (a callout after
the intro; steps/figures/video inside a product section). Each is a full `<tr>` — paste it between
existing `<tr>`s in the 600px container. Keep them table-based and inline-styled; do not reintroduce
flex/grid/SVG. Fill the `[TOKENS]` and delete any you don't use.

### Callout — important / breaking change

Amber = important; for a **breaking** change swap to red (`background:#fbeaeb; border:1px solid
#e3b9bb;` and label `color:#a8282d;`).

```html
<tr>
  <td style="padding:28px 40px 0 40px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#fff6e0; border:1px solid #f0dcae; border-radius:8px;">
      <tr>
        <td style="padding:18px 22px; font-family:'Lato','Helvetica Neue',Arial,sans-serif;">
          <div style="font-size:12px; font-weight:700; letter-spacing:0.10em; text-transform:uppercase; color:#c79400;">[CALLOUT_LABEL]</div>
          <div style="margin-top:6px; font-size:16px; line-height:1.55; color:#231F20;">[CALLOUT_BODY]</div>
        </td>
      </tr>
    </table>
  </td>
</tr>
```

### Action-required steps

Repeat the inner `<tr>` once per step (bump the number).

```html
<tr>
  <td style="padding:28px 40px 0 40px;">
    <div style="font-family:'Lato','Helvetica Neue',Arial,sans-serif; font-size:16px; font-weight:700; color:#231F20;">[STEPS_HEADING]</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;">
      <tr>
        <td valign="top" width="28" style="padding:4px 10px 4px 0; font-family:'Lato','Helvetica Neue',Arial,sans-serif; font-size:15px; font-weight:700; color:#0063A6;">1.</td>
        <td valign="top" style="padding:4px 0; font-family:'Lato','Helvetica Neue',Arial,sans-serif; font-size:15px; line-height:1.55; color:#231F20;">[STEP_1]</td>
      </tr>
    </table>
  </td>
</tr>
```

### Screenshot figure

`[IMAGE_URL]` **must** be a public `https://` URL (see Images & hosting below). Always set a real
`[IMAGE_ALT]` — many clients show it before/instead of loading the image.

```html
<tr>
  <td style="padding:24px 40px 0 40px;">
    <img src="[IMAGE_URL]" alt="[IMAGE_ALT]" width="520" style="display:block; width:100%; max-width:520px; height:auto; border:1px solid #e6e9ea; border-radius:6px;">
    <div style="margin-top:8px; font-family:'Lato','Helvetica Neue',Arial,sans-serif; font-size:13px; color:#767e80;">[IMAGE_CAPTION]</div>
  </td>
</tr>
```

### Video — click-to-play thumbnail (links out)

Email can't play video and can't reliably overlay a play button, so **bake the play triangle into
the poster image itself** and link the whole thing to the hosted video (`[VIDEO_URL]` → YouTube /
Vimeo / a BlueStep page).

```html
<tr>
  <td style="padding:24px 40px 0 40px;">
    <a href="[VIDEO_URL]" style="text-decoration:none;">
      <img src="[VIDEO_POSTER_URL]" alt="[VIDEO_ALT] — watch the video" width="520" style="display:block; width:100%; max-width:520px; height:auto; border:1px solid #e6e9ea; border-radius:6px;">
    </a>
    <div style="margin-top:8px; font-family:'Lato','Helvetica Neue',Arial,sans-serif; font-size:13px; color:#767e80;">[VIDEO_CAPTION] &middot; <a href="[VIDEO_URL]" style="color:#0063A6;">watch &rarr;</a></div>
  </td>
</tr>
```

## Images & hosting

Email clients don't embed local files — every image is either a **public URL** or a **CID
attachment**. Rules of thumb:

- **Logo** (small, every email): a stable **public URL** is simplest (`[LOGO_URL]`); CID-embed via
  the platform's `B.util.email` `attach`/`embedAll` is the alternative if image-blocking is a
  concern. Either way it's a one-time setup (setup guide §4). Until it's hosted, the header falls
  back to the "BlueStep" wordmark text — that's fine.
- **Screenshots** (per release): upload to a **public-read BlueStep Document Library folder**, then
  reference each by its absolute URL in a Screenshot-figure block. Keeps the email light. The URL
  must stay public and stable — if the file is later moved/deleted, old emails show a broken image
  (acceptable for a dated newsletter).
- **Video posters:** same as screenshots — a hosted poster image that links out.

Always set `alt` text (images are blocked-by-default in many clients until "show images"), size with
`width` + `max-width:100%; height:auto`, and prefer PNG/JPG (no SVG — Outlook/Gmail drop it).

## Quick check before sending

Open `email.html` in a browser to eyeball it, then run it through an email-rendering preview and
look at **Outlook (Word engine) and Gmail**: confirm the fallback fonts carry, any hosted images
load (and show sensible `alt` when blocked), and the per-product section block repeats cleanly.
