# The design check: canvas export beside the live screen

Load after a UI publish has passed the served check (`served-check.md`), and when writing a
change's `design-audit.md` (template: `${CLAUDE_PLUGIN_ROOT}/templates/spec/design-audit.md`).

The approved canvas is the visual spec. Rules (required, locked, options) still come from the
form definitions, not from the picture.

1. **The export.** A Design artifact in Claude is exported as one HTML page (*Share* › *Export* ›
   *HTML*) and unpacked into the build repo's `mockups/<name>/` with
   `node "${CLAUDE_PLUGIN_ROOT}/tools/unpack-artifact.mjs" <export.html> <dir>`: per frame,
   `NN-<title>.html` to serve and `NN-<title>.dc.html`, the source to cite. A canvas approved in
   standalone Claude Design keeps its old export, the *Project HTML* zip unzipped as it came. The
   change's design notes name it. This happens before the first build task.
2. **Serve it** with `node "${CLAUDE_PLUGIN_ROOT}/tools/serve-canvas.mjs" <dir> <port> [file]`
   (the `launch.json` entry in `${CLAUDE_PLUGIN_ROOT}/templates/launch.json` does the same from the
   preview pane); for an unpacked artifact, `[file]` is a frame's `.html` (the folder holds several
   `.dc.html`, which do not render alone). `window.BluestepUi.version` in the served page's console
   must be the design-system version the canvas was meant to draw with. The artboards render only
   near the view: jump with `getElementById('<n>')` and wait a moment before a screenshot.
3. **Read sizes from the export's source**, not from a picture: the `.dc.html` keeps every inline
   style, grid template and kit component name. On the live page and on the export,
   `${CLAUDE_PLUGIN_ROOT}/tools/computed-styles.js` (pasted in the console) prints size, padding,
   gap, font, colours, border, radius and shadow as JSON, so numbers are compared, not looks.
4. **States on demand.** `${CLAUDE_PLUGIN_ROOT}/tools/fetch-wrapper.js` (pasted after the app has
   loaded) holds, empties, fails or refuses a GraphQL operation by name, to reach loading, empty,
   error and read-only states without another user. Test data only.
5. **One row per difference** in the change's `design-audit.md`, per artboard, both at 1440 px: what
   the canvas draws, what the build draws, and **Fix** or **Keep** with its reason. "Our call" alone
   is no reason for a look. The rows become the UI tasks' checklist and, after the fix-up publish,
   their done-when.
6. Every row has a verdict before the UI task's done-when is re-read and the task ticked.
