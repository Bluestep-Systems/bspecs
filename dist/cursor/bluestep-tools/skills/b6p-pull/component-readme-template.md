# [Component displayName]

<!--
This README documents what the component does today. It lives at
draft/README.md inside the component folder so it ships to the BlueStep
platform on push, which means anyone who pulls the component gets the doc.

This file is NOT for planning new work — use `/spec-create` for that
(specs live under .claude/specs/<feature-name>/).

When `/b6p-pull` scaffolds this file, it infers what it can from the
component's code (app.ts), its legacy draft/info/metadata.json if it has one, and
static assets (for MergeReports). Sections it cannot infer are left
empty or marked "TODO" — fill them in before editing code.
-->

## Overview

[One paragraph: what this component does and why it exists.]

## Type

[Endpoint | MergeReport | Post-Save | OnDemand | Scheduled | Formula]

[For Endpoint: list paths, allowed methods, auth model.]
[For MergeReport: list pages/sections rendered, whether it owns frontend.]
[For Post-Save: list the form(s) that trigger it.]
[For Scheduled: list the cron cadence and what it does.]

## Fields used

| FID     | Display name | Form     | Access       |
|---------|--------------|----------|--------------|
| fid_xxx | …            | FormName | read / write |

## Behavior

[Bulleted description of what the component does at runtime. One bullet per coherent behavior.]

## External dependencies

[Outbound HTTP endpoints, other B6P components this one calls or expects.]

## Edge cases / known gotchas

[Anything non-obvious that future-you or another dev should know before editing.]
