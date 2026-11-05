# <Change name>: the built screens against the approved canvas

Started before any screen is built, so that every difference has its row from the first task. The
build matches the canvas's layout in full; a difference needs a written reason, never an omission.

## How it was done

- **The canvas.** Its name, the round approved, who approved it, the export's folder and the
  `launch.json` entry that serves it (port). Sizes and colors come from the export's own source,
  not from a picture.
- **The build.** The published build at 1440 px beside the artboards each UI task names. Each UI
  task fills *Verdict* for its rows: **matched**, **Fix** (a task changes it) or **Keep** (with
  its reason). *Verdict* stays empty until then.
- **A valid reason to differ:** a later review decision, a form rule the canvas did not draw
  (required marks, locks and options come from the form definitions), an answered question,
  or a platform limit. "Our call" alone is not a reason for a look. Leaving something out is a
  difference too.
- **The element list.** Who drew it, from what (the export's source, with line numbers), and who
  read it a second time.
- **Numbers.** What the source sets is copied as written; where it leaves a size to a kit
  component, the cell says so and the number read with the computed-styles tool on the served
  export is marked as a measurement.
- **Columns.** *Artboards*, *Element*, *Canvas (numbers, words)*, *Source* (line numbers),
  *Feeds from* (the form and field, a setting, a rule file, the host, or "fixed words"), *Task*,
  *Verdict*.

## Host (shell and record frame), checked, not built

What the host already draws around the component, and whether it matches the canvas.

## <Screen id> · <screen name> (artboards <numbers>)

One table per screen with the columns above, one row per element; a variant is its own row.

## What a still picture cannot show

The behaviours the design notes decide, each a row.

## Fields added to Forms read

Fields the build needed that the design notes did not list.

## Coverage

Every artboard with the rows that draw it, built from the *Artboards* column by a script, so a row
id appears only where its cell lists the artboard. Every artboard has rows.

## Settled points

Numbered, each an *Our call* with its reason, open to correction; none changes the look the canvas
draws unless it says so.

## Second reading

Which artboards a second reader checked for missing elements, and what they found.

## Live checks

One block per pass: the date, the build (commit), who, and one line per verification step of the
change's task list.
