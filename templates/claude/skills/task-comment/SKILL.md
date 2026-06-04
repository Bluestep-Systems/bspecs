---
name: task-comment
description: Draft a standardized implementation comment for a ClickUp task after a fix or feature is shipped. Handles both org-propagated (component-based) and direct (code-only) changes.
---

# /task-comment — Draft a ClickUp implementation comment

## Steps

1. **Ask the user to paste the ClickUp task link or ID.**
   - Use the ClickUp MCP to fetch the task (`clickup_get_task`) and read its name, description, list, and status.

2. **Infer the change type from the task name prefix:**
   - Starts with `Bug -` or `Bug —` → type = **Fix**
   - Starts with `Feature -` or `Feature —` → type = **Feature**
   - Anything else → type = **Update**

3. **Derive the summary** from the task name and description — one sentence capturing what the bug/issue/feature was. Do not ask the user for this.

4. **Ask one question:**
   > Does this change need to be propagated to other orgs? (yes / no)

5. **Collect the remaining details based on the answer:**

   **If yes (propagated — component change):**
   - Component name (e.g. `Audits`, `Appointments`)
   - Affected file(s): path(s) relative to the component (e.g. `draft/scripts/utils/entryHelper.ts`)
   - Orgs deployed to (comma-separated list)
   - What changed and why (free-form, 1–4 sentences)

   **If no (direct — code/API/formula fix):**
   - What changed mechanically (1–3 sentences)
   - Root cause, if known (1–2 sentences, or "N/A")
   - Net effect / user-visible outcome (1 sentence)
   - Any caveats or known limitations (optional)

6. **Produce the formatted comment. Do not post it — print it directly in your response (NOT in a code block) so the user can copy the rich text and paste it into ClickUp with bold formatting intact.**

---

## Output formats

ClickUp does not render markdown. Use `**bold**` only for structural labels — ClickUp will receive the bold formatting when the user copies and pastes rich text from the response. Body text stays plain.

The comment always has three sections separated by blank lines: **Summary**, **Change**, and (if propagated) **Components**.

### Propagated (yes)

**Summary:** <one sentence derived from the task name/description>

**<Type> implemented**

<What changed and why>

**Component:** <ComponentName>

<ComponentName>
<file/path.ts>

**Deployed to:** <Org1>, <Org2>, <Org3>.

---

- `<Type>` = Fix / Feature / Update (from step 2)
- If multiple files, list each on its own line under the component name
- If only one org, write "**Deployed to:** <Org>." (no comma)

### Direct (no)

**Summary:** <one sentence derived from the task name/description>

**<Type> shipped (<YYYY-MM-DD>)**

<What changed mechanically>

**Root cause:** <root cause, if provided>

**Net effect:** <user-visible outcome>

**Caveat:** <caveat, if provided>

---

- `<Type>` = Fix / Feature / Update (from step 2)
- Omit the **Root cause:** line if the user said N/A
- Omit the **Caveat:** line if none provided
- Use today's date for `<YYYY-MM-DD>`

---

## Notes

- Never post to ClickUp automatically. Always print the comment directly in the response (no code block) so the user can copy rich text and paste it into ClickUp with bold formatting intact.
- Do not add a greeting, sign-off, or closing line.
- Keep the tone matter-of-fact. No "Great news!" or "Happy to report".
- If the task name has no recognizable prefix, default to **Update** and don't ask the user to clarify.
