// Computed styles of chosen elements, as JSON, to compare a live page with a canvas export by numbers
// rather than by eye (the design check in the BlueStep One reference).
//
// Paste the whole file into the browser console (the live component page, or the export served by
// tools/serve-canvas.mjs), then:
//
//   cs(["#ab-13 button", "#ab-13 h1"])               every element each selector matches (5 at most)
//   cs(["button"], { root: "#ab-25", max: 2 })       selectors inside one artboard, 2 per selector
//   cs([someElement, ...someElement.children])       elements themselves
//
// For each element: its size, padding, margin, gap, display, position, grid template, flex, font
// size, line height and weight, text color, background, border, radius and shadow, and the first
// words of its text so the match can be told apart. Sides print as CSS's shorthand does (one, two
// or four values). Colors print as the browser computes them and as #rrggbb(aa), drawn on a 1 px
// canvas, so `oklch()` on one side and `rgb()` on the other still compare. Sizes are the drawn box
// to 0.1 px; when a zoom (a CSS transform, as the canvas viewer's) makes it differ from the layout
// box, the layout size is printed beside it. The result is printed and returned.
(() => {
  const paint = document.createElement("canvas").getContext("2d", { willReadFrequently: true });

  function hex(color) {
    if (!color || color === "transparent" || color === "rgba(0, 0, 0, 0)") return "transparent";
    paint.clearRect(0, 0, 1, 1);
    paint.fillStyle = "#000";
    paint.fillStyle = color;
    paint.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = paint.getImageData(0, 0, 1, 1).data;
    const two = (n) => n.toString(16).padStart(2, "0");
    return `#${two(r)}${two(g)}${two(b)}${a === 255 ? "" : two(a)}`;
  }

  const color = (value) => (value === hex(value) ? value : `${value} = ${hex(value)}`);

  // As CSS writes the shorthand: one value, two (top and bottom, left and right), or four.
  function sides(style, prefix) {
    const [top, right, bottom, left] = ["top", "right", "bottom", "left"].map((side) => style.getPropertyValue(`${prefix}-${side}`));
    if (top === bottom && right === left) return top === right ? top : `${top} ${right}`;
    return `${top} ${right} ${bottom} ${left}`;
  }

  // The drawn size to 0.1 px; the layout size beside it when a zoom (a transform) makes them differ.
  function size(el) {
    const box = el.getBoundingClientRect();
    const drawn = `${Math.round(box.width * 10) / 10} × ${Math.round(box.height * 10) / 10}`;
    const zoomed = Math.abs(box.width - el.offsetWidth) > 1 || Math.abs(box.height - el.offsetHeight) > 1;
    return zoomed ? `${drawn} drawn, ${el.offsetWidth} × ${el.offsetHeight} before the zoom` : drawn;
  }

  function border(style) {
    const each = ["top", "right", "bottom", "left"].map((side) => {
      const width = style.getPropertyValue(`border-${side}-width`);
      const kind = style.getPropertyValue(`border-${side}-style`);
      return kind === "none" || width === "0px" ? "none" : `${width} ${kind} ${hex(style.getPropertyValue(`border-${side}-color`))}`;
    });
    return each.every((value) => value === each[0]) ? each[0] : each.join(" | ");
  }

  function radius(style) {
    const corners = ["top-left", "top-right", "bottom-right", "bottom-left"].map((c) => style.getPropertyValue(`border-${c}-radius`));
    return corners.every((value) => value === corners[0]) ? corners[0] : corners.join(" ");
  }

  function describe(el, label) {
    const style = getComputedStyle(el);
    const out = {
      match: label,
      tag: el.tagName.toLowerCase() + (el.id ? `#${el.id}` : ""),
      text: (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 50),
      size: size(el),
      display: style.display,
      position: style.position === "static" ? undefined : `${style.position} (top ${style.top}, bottom ${style.bottom})`,
      padding: sides(style, "padding"),
      margin: sides(style, "margin"),
      gap: style.rowGap === style.columnGap ? style.rowGap : `${style.rowGap} ${style.columnGap}`,
      gridTemplateColumns: style.gridTemplateColumns === "none" ? undefined : style.gridTemplateColumns,
      gridTemplateRows: style.gridTemplateRows === "none" ? undefined : style.gridTemplateRows,
      flex: style.display.includes("flex") ? `${style.flexDirection} ${style.flexWrap}; justify ${style.justifyContent}; align ${style.alignItems}` : undefined,
      font: `${style.fontSize} / ${style.lineHeight}, weight ${style.fontWeight}${style.fontStyle === "normal" ? "" : `, ${style.fontStyle}`}`,
      fontFamily: style.fontFamily.split(",")[0].trim(),
      textTransform: style.textTransform === "none" ? undefined : style.textTransform,
      letterSpacing: style.letterSpacing === "normal" ? undefined : style.letterSpacing,
      color: color(style.color),
      background: color(style.backgroundColor),
      border: border(style),
      radius: radius(style),
      shadow: style.boxShadow === "none" ? undefined : style.boxShadow,
    };
    for (const key of Object.keys(out)) if (out[key] === undefined) delete out[key];
    return out;
  }

  window.cs = (targets, { root = document, max = 5 } = {}) => {
    const scope = typeof root === "string" ? document.querySelector(root) : root;
    if (!scope) throw new Error(`cs: no element matches root ${root}`);
    const result = [];
    for (const target of targets) {
      if (target instanceof Element) {
        result.push(describe(target, "(element)"));
        continue;
      }
      const found = [...scope.querySelectorAll(target)];
      if (found.length === 0) result.push({ match: target, missing: true });
      found.slice(0, max).forEach((el, i) => result.push(describe(el, found.length > 1 ? `${target} [${i + 1} of ${found.length}]` : target)));
    }
    console.log(JSON.stringify(result, null, 2));
    return result;
  };
  return "cs ready: cs([selectors], { root, max })";
})();
