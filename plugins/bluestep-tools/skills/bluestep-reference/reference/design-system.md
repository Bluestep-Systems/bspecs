# BlueStep Design System

## Contents

- [Overview](#overview)
- [Component Source Priority](#component-source-priority)
- [Design Standards](#design-standards)
- [Standard Components](#standard-components)
- [Bootstrap Components](#bootstrap-components)
- [Using the Design System](#using-the-design-system)
- [Related Documentation](#related-documentation)
- [Access](#access)

> **Primary Reference**: The complete BlueStep Design System is available as an interactive merge report at:
> **https://bluestepplatformsupport.bluestep.net/shared/layouts/singleblock.jsp?_event=view&_id=120130___195147**

## Overview

The BlueStep Design System is a comprehensive library of reusable components, design standards, and guidelines for BlueStep.js development. It serves three main purposes:

1. **Establish clear standards** - Provide consistent design and development patterns for designers and developers
2. **Component reference** - Serve as a comprehensive reference for UI components for both developers and AI agents
3. **Rapid prototyping** - Enable AI agents to quickly create mockups based on user instructions

## Component Source Priority

When creating mockups and developing software, components should be sourced in the following priority order:

1. **BlueStep Generic Components** - Use components from the genericComponents library first (e.g., `moduleF`, `headF`, `svgF`, `tableF`)
2. **Bootstrap 3.3.7 Components** - Use standard Bootstrap components when no generic component exists (e.g., buttons, alerts, modals, panels)
3. **Custom Components** - Create from scratch only when necessary, inferring styles from the above sources to maintain consistency

This priority ensures consistency across BlueStep applications and leverages existing, tested components whenever possible.

## Design Standards

The design system includes comprehensive documentation for:

### Color Palette

**Standard Colors (CSS Variables)** - Available to all BlueStep pages:
- `--bs-red: #c03b2b`
- `--bs-orange: #F29D1F`
- `--bs-yellow: #EFC319`
- `--bs-green: #28AE60`
- `--bs-blue: #2A81BA`
- `--bs-logo-blue: #0063A6` (Brand logo color, used in email templates)
- `--bs-purple: #894C9E`
- `--bs-gray: #969FA0`
- `--bs-default: #2D3F50` (Default theme color)

**Custom Generated Colors (Style-Based)** - Generated based on currently selected color style:
- `--bs-primaryColor`
- `--bs-primaryColorHigh`
- `--bs-accent1Color`
- `--bs-accent2Color`
- `--bs-secondaryColor`
- `--bs-secondaryColorHigh`

> **Note**: Custom generated colors vary based on the organization's color style selection. Always use CSS variables for colors to ensure consistency.

### Typography

The design system documents standard typography patterns, font sizes, and text styling conventions for BlueStep applications.

### Spacing Scale

Standard spacing values and guidelines for consistent layout spacing throughout BlueStep applications.

## Standard Components

The design system provides comprehensive documentation for all BlueStep generic components:

- **SVG Icons** (`svgF` / `svgIconF`) - Icon generation with size, color, and modifier options
- **Headers** (`headF`) - Standard and collapsible section headers
- **Tables** (`tableF`) - Data table generation
- **Fields** (`fieldF`) - Form field formatting
- **Bootstrap Forms** (`bootstrapFormF`) - Complete form generation
- **Modules** (`moduleF`) - Full page layouts with tabs
- **Generic HTML Tags** (`tagF`) - Custom HTML element generation
- **Anchor Tags** (`aF`) - Link generation
- **Email Templates** (`emailF`) - Responsive email generation
- **Breadcrumbs** (`breadcrumbF`) - Navigation breadcrumbs
- **Search Components** (`searchHeadF`, `searchTextF`) - Search interface components
- **Date Input** (`bsDateInput`) - Date picker components
- **Date Range** (`jsDateRange`) - Date range selection
- **Popin Hints** (`popinHintF`) - Contextual help tooltips
- **SVG with Title** (`svgTitleF`) - Icons with text labels
- **Horizontal Form Layout** (`bsHorizFormCol2F`, `bsHorizFieldCol2F`) - Two-column form layouts

Each component includes:
- Description and use cases
- Code examples
- Parameter documentation
- Visual examples
- Usage guidelines
- Accessibility notes

## Bootstrap Components

The design system also documents standard Bootstrap 3.3.7 components:

- Buttons
- Alerts
- Badges
- Labels
- Panels
- Wells
- Modals
- Tooltips
- Popovers
- Tabs
- Accordion
- Pagination

## Using the Design System

### For AI Agents

When creating mockups or building BlueStep.js applications:

1. **Reference the design system first** - Check the interactive design system merge report for component examples and patterns
2. **Follow component priority** - Use BlueStep generic components before Bootstrap, and Bootstrap before custom HTML
3. **Use design standards** - Apply color palette, typography, and spacing scale consistently
4. **Check component documentation** - Review parameter lists, examples, and usage guidelines in the design system

### For Developers

1. **Browse the interactive design system** - Use the merge report to see live examples of all components
2. **Copy code examples** - Use the provided code examples as starting points
3. **Follow usage guidelines** - Adhere to accessibility and best practice recommendations
4. **Reference component API** - Check the design system for parameter documentation

### For Designers

1. **Review design standards** - Understand color palette, typography, and spacing conventions
2. **Explore component library** - See all available components and their visual appearance
3. **Understand component capabilities** - Know what's possible with existing components before requesting custom solutions

## Related Documentation

- **Component Library Usage** - See `agents-support/component-library.md` for quick reference on common components
- **Component Source** - See `https://files.bluestep.net/script/530024___41/static/genericComponents.js` for complete API documentation
- **Icon Reference** - See the BlueStep Icon Reference for complete icon list and categories

## Access

**Design System URL**: https://bluestepplatformsupport.bluestep.net/shared/layouts/singleblock.jsp?_event=view&_id=120130___195147

The design system is also available in the workspace at `U129801/BlueStep.js Components` for local reference.
