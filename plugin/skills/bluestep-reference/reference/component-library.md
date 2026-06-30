# Component Library

> **Note**: for the complete component API, see the JSDoc in `https://files.bluestep.net/script/530024___41/static/genericComponents.js`. This file contains usage patterns and best practices.
>
> **Design System**: for visual examples, color palette, typography, and spacing, see [design-system](design-system.md) or the [interactive design system merge report](https://bluestepplatformsupport.bluestep.net/shared/layouts/singleblock.jsp?_event=view&_id=120130___195147).

**Always check this library before writing custom HTML-generation code.**

## Contents

- [Component Source Priority](#component-source-priority)
- [Configuration and Importing](#configuration-and-importing)
- [CSS and Merge Report Styling](#css-and-merge-report-styling)
- [Design Standards](#design-standards)
- [Common Components](#common-components)
- [Best Practices](#best-practices)
- [When NOT to Use Components](#when-not-to-use-components)

## Component Source Priority

When building UI, source components in this order:

1. **BlueStep generic components** — use `moduleF`, `headF`, `svgF`, `tableF`, etc. first.
2. **Bootstrap 3.3.7 components** — standard Bootstrap (buttons, alerts, modals, panels) when no generic component exists.
3. **Custom components** — only when necessary, matching the styles of the above.

## Configuration and Importing

The recommended setup is to register the library in `info/config.json`, then import with the short name:

```json
{
  "models": [
    {
      "name": "genericComponents.ts",
      "url": "https://files.bluestep.net/script/530024___41/static/genericComponents.ts"
    }
  ]
}
```

```typescript
// ✅ Recommended - when configured in config.json
import { moduleF, svgF, headF, tableF } from 'genericComponents';
```

If it is not configured, you can import from the full hosted URL as a fallback, but adding it to `config.json` is preferred:

```typescript
import { moduleF, svgF, headF, tableF } from 'https://files.bluestep.net/script/530024___41/static/genericComponents.js';
```

> ⚠️ **`type="module"` required in `index.html`.** When `script.ts` uses an ES `import` (including importing from `genericComponents`), the `<script>` tag must include `type="module"`, or the browser throws `SyntaxError: Cannot use import statement outside a module` and the script silently fails.
>
> ```html
> <script type="module" src=".build/script.js"></script>
> ```

## CSS and Merge Report Styling

Standard BlueStep pages (Connect/Manage) already provide their own HTML and CSS, and the component-library functions (`moduleF`, `headF`, `svgF`, `tableF`, `fieldF`, `bootstrapFormF`) are designed to work within that styling.

- **Do NOT add CSS in the merge report for component-library output.** It is already styled by the platform and the library; extra CSS is unnecessary and can conflict with the theme and layout.
- **Add CSS only for custom HTML** you introduce outside the standard components (custom wrappers, one-off layouts, third-party widgets). Put it in `static/styles.css` referenced from `static/index.html`, scoped to that custom markup only.

## Design Standards

### Color palette (CSS variables)

Always use CSS variables for colors so they stay consistent across themes.

Standard colors (available on all BlueStep pages):

- `--bs-red: #c03b2b` | `--bs-orange: #F29D1F` | `--bs-yellow: #EFC319`
- `--bs-green: #28AE60` | `--bs-blue: #2A81BA` | `--bs-purple: #894C9E`
- `--bs-logo-blue: #0063A6` (brand logo color, used in email templates)
- `--bs-gray: #969FA0` | `--bs-default: #2D3F50` (default theme color)

Custom generated colors (vary by the organization's color style):

- `--bs-primaryColor` | `--bs-primaryColorHigh`
- `--bs-accent1Color` | `--bs-accent2Color`
- `--bs-secondaryColor` | `--bs-secondaryColorHigh`

### Available components

- **SVG Icons** (`svgF` / `svgIconF`, `svgTitleF`) | **Headers** (`headF`) | **Tables** (`tableF`)
- **Fields** (`fieldF`) | **Bootstrap Forms** (`bootstrapFormF`) | **Modules** (`moduleF`)
- **Generic Tags** (`tagF`) | **Anchors** (`aF`) | **Email Templates** (`emailF`)
- **Breadcrumbs** (`breadcrumbF`) | **Search** (`searchHeadF`, `searchTextF`)
- **Date Input** (`bsDateInput`) | **Date Range** (`jsDateRange`) | **Popin Hints** (`popinHintF`)
- **Horizontal Forms** (`bsHorizFormCol2F`, `bsHorizFieldCol2F`)

## Common Components

### SVG Icons

**When to use**: all icon needs (don't use `<img>` directly).

```typescript
import { svgF } from 'genericComponents';

const icon = svgF({ icon: 'settings', size: 48 });
const colored = svgF({ icon: 'settings', size: 24, color: 'white blue' });
// Common icons: trash, pencil, gear3, circleCheck, circleX, calendar2, magnify, plus
```

⚠️ **REQUIRED: reference the icon endpoint before using any icon.** Before selecting or suggesting an icon, query the official BlueStep SVG icons endpoint:

- **URL**: `https://bluestepplatformsupport.bluestep.net/b/svgIconsList`
- **Returns**: a JSON array where each icon has `icoName` (e.g. `"calendar.svg"`), `category` (e.g. `["Standard", "System and Technical"]`), and `icoKeywords` (e.g. `"calendar, day, week, month, year, schedule"`).

How to use it: search the endpoint by name, category, or keyword; use the icon name **without** the `.svg` extension (`calendar.svg` → `svgF({ icon: 'calendar', size: 24 })`); match the icon to context via categories/keywords. Never guess icon names or use icons not listed in the endpoint.

### Headers

**When to use**: section headers, collapsible sections.

```typescript
import { headF } from 'genericComponents';

const header = headF({ title: 'Section Title' });
const withButton = headF({ title: 'Section Title', button: '<button>Action</button>', hint: 'Help text' });
const collapsible = headF({ title: 'Collapsible Section', isCollapsable: true, content: '<div>Content</div>', isOpen: true });
```

### Tables

**When to use**: simple data tables (use Tabulator for complex tables).

```typescript
import { tableF } from 'genericComponents';

const table = tableF({
  className: 'table table-striped',
  showHeaders: true,
  tableRows: [ { 'Name': 'John', 'Age': '30' }, { 'Name': 'Jane', 'Age': '25' } ]
});
```

### Modules

**When to use**: full page layouts in Connect/Manage.

```typescript
import { moduleF } from 'genericComponents';

const module = moduleF({
  id: 'dashboard',
  header: 'Dashboard',
  tabs: [
    { icon: 'home',  label: 'Overview', className: 'cDefault', tabContent: overviewContent },
    { icon: 'chart', label: 'Reports',  className: 'cReports', tabContent: reportsContent }
  ]
});
```

**Module colors**: cDefault, cReports, cOrange, cGreen, cBlue, cYellow, cPurple, cRed, cBrown.

### Email Templates

**When to use**: all email generation (don't create custom email HTML).

```typescript
import { emailF } from 'genericComponents';

const email = emailF({
  title: 'Account Verification',
  previewText: 'Please verify your email address',
  bodyText: 'Click the button below to verify your email address.',
  btnLink: 'https://example.com/verify?token=xyz',
  btnText: 'Verify Email',
  primaryColor: '0063A6',
  logoImg: 'https://example.com/logo.png'
});
```

### Forms

**When to use**: form inputs in Connect/Manage pages.

```typescript
import { bootstrapFormF } from 'genericComponents';

const form = bootstrapFormF({
  id: 'user-form',
  labelSize: 'third',
  fields: [
    { fieldLabel: 'Name', fieldId: 'name', fieldType: 'text' },
    { fieldLabel: 'Role', fieldId: 'role', fieldType: 'select',
      fieldList: [ { idValue: 'admin', label: 'Administrator' }, { idValue: 'user', label: 'User' } ] },
    { fieldLabel: 'Active', fieldId: 'active', fieldType: 'checkbox', fieldIsSelected: true }
  ]
});
```

(For generating form fields from real BlueStep fields with labels and validation, see `mergeTag()` in [api-patterns](api-patterns.md#mergetag-method).)

## Best Practices

**DO ✅**

1. Use the component library first; reach for raw HTML only when nothing fits.
2. Use semantic components: `moduleF()` for layouts, `headF()` for headers, `svgF()` for icons, `emailF()` for emails.
3. Check the JSDoc in the source for the complete API.

**DON'T ❌**

1. **Don't add CSS for component-library output** — it is already styled (see [CSS and Merge Report Styling](#css-and-merge-report-styling)).
2. **Don't recreate existing components** — use `tableF({ tableRows: data })`, not a hand-built `<table>`.
3. **Don't use inline SVG or `<img>` for icons** — use `svgF({ icon: 'settings', size: 24 })`.
4. **Don't create custom email HTML** — always use `emailF()`.
5. **Don't mix component styles** — use the Bootstrap classes from the components and the module color scheme.

## When NOT to Use Components

Some cases require custom HTML: complex interactive UIs (use frameworks like Tabulator), real-time dashboards with heavy client logic, or highly customized layouts that don't match BlueStep patterns. Even then, use components for sub-elements (`svgF`, `headF`, etc.).
