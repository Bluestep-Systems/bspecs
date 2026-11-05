// The tab guard as a mod: the same reading of a browser script as the settings hook tab-guard.mjs
// (one file, lib/tab-script.mjs), plus what a settings hook cannot do. It ships in the plugin with
// that hook and loads wherever mods are on.
//
// - tool.call on the browser script tools: a script with no mutation goes on untouched. Any other
//   mutation in a script that does not open with a comment saying what it saves goes back to
//   Claude (UNSAID), with no card: a card that cannot say what it saves leaves the user to read
//   GraphQL. A lone build or publish of a components[] id needs no comment: the mod words it from
//   the component's name. Every mutation is held, a build or publish too, since bluestep-tools'
//   guard asks about those: a pane (or, where no pane is placed, the band above the prompt) shows
//   what the script says it does, the site the tab is on, and Proceed / Cancel. In a session the
//   app is not showing, the pane waits and is drawn when the user opens it. Cancel refuses the call. Proceed leaves a ticket for this
//   exact call (lib/tab-script.mjs, TICKET_FOLDER) and lets it on to the settings hooks, this
//   plugin's and bluestep-tools', which find the ticket and do not ask again. A mod cannot change
//   a settings hook's answer where Claude Code's built-in guard (cc-plugin-sec-default) runs
//   first, as under a Team or Enterprise sign-in, so each hook decides for itself from the ticket.
//   Claude Code's own permission prompt is not the mod's to answer either (a tool.check allow was
//   skipped there, seen live): the project's settings allow the browser tools, so after Proceed
//   nothing else asks.
// - The site is read just before the card shows, from the browser's tab list (origin only). The
//   mods API has no read of the browser pane's URL. When that read fails, the card says it could
//   not tell: the mod remembers nothing between calls.
//
// If anything here fails, no ticket is left and the call goes on to the settings hooks, which ask
// as they always did.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { NOTIFIER, TICKET_FOLDER, buildsAndPublishes, classify, fetchOrigins, mutationTexts, scriptsOf, summaryOf, ticketText, variableTexts } from './lib/tab-script.mjs'
import type { TabGuardHeld, TabGuardTarget } from '../types'

const PANE_ID = 'tab-guard'
const SCRIPT_TOOL = /^mcp__(Claude_Browser|claude-in-chrome)__(javascript_tool|browser_batch)$/
// The card's title: the first sentence of the settings hook's ask (hooks/tab-guard.mjs), so the
// two questions read as one.
export const ASK_TEXT = 'This script would change data in BlueStep.'
// What Claude reads when a changing script does not say what it saves. The card shows that
// comment as the user's one line on the change, so the script never reaches the user without it.
export const UNSAID =
  'Nothing ran. This script changes data in BlueStep, so the user is asked first, and the card shows the comment the script opens with. Start each script that changes data with a one-line comment saying, in plain words, what it saves and where (for example `// Moves three reports into Team Reports and hides the old links`), with no org, host or id, then run it again.'
export const NOTIFY_TITLE = 'BlueStep One · Tab guard: a change is waiting for you'
const HOLD_LIMIT_MS = 10 * 60 * 1000
// The tab list of each browser server, read before the card shows.
const TAB_LIST: Record<string, string> = { Claude_Browser: 'tabs_context', 'claude-in-chrome': 'tabs_context_mcp' }

const held = atom({ plugin: 'bluestep-one', key: 'held' } as const, null as TabGuardHeld | null)

type Decision = 'proceed' | 'cancel'
type Verdict = Decision | 'timeout' | 'pass' | 'unsaid'
type Config = { components?: unknown[] }
type $ = EngineInterface

// ---- Reading the browser's tab list -----------------------------------------------------------

const originOf = (url: string): string | undefined => {
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.origin : undefined
  } catch {
    return undefined
  }
}

// What one browser result says about the tabs: the "Tab Context" block the built-in pane's calls
// end with, or a tab list (tabs_context's JSON), with the active tab.
export function tabsFromResult(text: string): { urls: Record<string, string>; active?: string } {
  const urls: Record<string, string> = {}
  let active: string | undefined
  for (const line of text.split(/\r?\n/)) {
    const tab = /tabId[:\s]+"?([^\s:",]+)"?/.exec(line)
    const url = [...line.matchAll(/https?:\/\/[^\s"')]+/g)].pop()
    if (tab?.[1] && url && !/Executed on/.test(line)) urls[tab[1]] = url[0]
  }
  const json = /^\s*(\{[\s\S]*?\})\s*(?:\n[^{\s]|$)/.exec(text)
  if (json?.[1]) {
    try {
      const value = JSON.parse(json[1]) as { tabs?: { tabId?: unknown; origin?: unknown; url?: unknown; isActive?: unknown }[] }
      for (const t of value.tabs ?? []) {
        const id = t.tabId === undefined ? undefined : String(t.tabId)
        const where = typeof t.url === 'string' ? t.url : typeof t.origin === 'string' ? t.origin : undefined
        if (id && where) urls[id] = where
        if (id && t.isActive === true) active = id
      }
    } catch {
      // not a tab list
    }
  }
  return { urls, active }
}

// ---- The project ------------------------------------------------------------------------------

const parentOf = (dir: string) => dir.replace(/[\\/][^\\/]*$/, '')

async function loadConfig($: $): Promise<Config | undefined> {
  const home = ((await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME')) ?? '').replace(/[\\/]+$/, '')
  let dir = (await $.session.cwd()).replace(/[\\/]+$/, '')
  for (let i = 0; i < 40 && dir; i++) {
    const file = `${dir}/.claude/bluestep-one.json`
    if (dir.toLowerCase() !== home.toLowerCase() && (await $.fs.exists(file))) {
      try {
        const value = JSON.parse((await $.fs.read(file)).replace(/^﻿/, '')) as unknown
        return value && typeof value === 'object' && !Array.isArray(value) ? (value as Config) : {}
      } catch {
        return {}
      }
    }
    const up = parentOf(dir)
    if (up === dir) break
    dir = up
  }
  return undefined
}

// ---- Where a held script would write ----------------------------------------------------------

function tabIdOf(input: Record<string, unknown>): string | undefined {
  if (input.tabId !== undefined) return String(input.tabId)
  const actions = Array.isArray(input.actions) ? (input.actions as { name?: unknown; input?: { tabId?: unknown } }[]) : []
  const item = actions.find((a) => /javascript_tool$/.test(String(a?.name ?? '')) && a.input?.tabId !== undefined)
  return item ? String(item.input!.tabId) : undefined
}

async function tabList($: $, server: string) {
  try {
    const answer = await Promise.race([
      $.mcp.call(server, TAB_LIST[server] ?? 'tabs_context', {}),
      $.clock.sleep(4000).then(() => undefined),
    ])
    if (!answer || answer.isError) return undefined
    const text = answer.content.map((b) => ('text' in b && typeof b.text === 'string' ? b.text : '')).join('\n')
    return tabsFromResult(text)
  } catch {
    return undefined
  }
}

// The site a script names in its fetch, or else the one its tab is on now; undefined when neither
// can be read.
async function targetOf($: $, server: string, input: Record<string, unknown>, scripts: string[]): Promise<TabGuardTarget> {
  const named = scripts.flatMap((s) => fetchOrigins(s) as string[])
  if (named.length > 0) return { origin: named[0] }
  const list = await tabList($, server)
  const tabId = tabIdOf(input) ?? list?.active
  return { origin: tabId ? originOf(list?.urls[tabId] ?? '') : undefined }
}

// What a script of own builds and publishes does, for the card: "Builds the task-board
// component from its draft", one clause per mutation.
function buildSummary(script: string, names: Map<string, string>): string {
  return (buildsAndPublishes(script) as { action: 'build' | 'publish'; id: string }[])
    .map(({ action, id }) => {
      const component = names.get(id) ? `the ${names.get(id)} component` : 'a component of this project'
      return action === 'build' ? `Builds ${component} from its draft` : `Publishes ${component}, so its last build goes live`
    })
    .join('; then ')
}

// ---- Holding a call ----------------------------------------------------------------------------

// The answer pressed for each held call. A module variable: a hot reload in the middle of a hold
// drops the answer, and the hold then times out.
const decisions = new Map<string, Decision>()

// What the person pressed, 'timeout' (no answer within HOLD_LIMIT_MS), 'unsaid' (a changing script
// does not open with a comment saying what it saves, so it goes back to Claude with no card), or
// 'pass': no card, so the call goes on to the settings hook, which asks as it did before the mod.
async function judge($: $, tool: string, toolUseId: string, server: string, input: Record<string, unknown>): Promise<Verdict> {
  const config = await loadConfig($)
  if (!config) return 'pass'
  const components = (Array.isArray(config.components) ? config.components : []) as { id?: unknown; name?: unknown }[]
  const own = new Set(components.map((c) => String(c?.id ?? '')).filter(Boolean))
  const names = new Map(components.map((c) => [String(c?.id ?? ''), typeof c?.name === 'string' ? c.name : '']))
  const scripts = scriptsOf(tool, input) as string[]
  const verdicts = scripts.map((s) => classify(s, own) as 'none' | 'own' | 'other')
  // A build or publish of an own component is held too: bluestep-tools' tab guard asks about it
  // unless a ticket says the user already said yes.
  const changing = scripts.filter((_, i) => verdicts[i] !== 'none')
  if (changing.length === 0) return 'pass'

  // A build or publish needs no comment: the mod says what it does from the component's name.
  const summaries = changing.map(
    (s) => (summaryOf(s) as string | undefined) ?? (classify(s, own) === 'own' ? buildSummary(s, names) : undefined)
  )
  // A card that cannot say what it saves is no help to the user: Claude adds the comment first.
  if (summaries.includes(undefined)) return 'unsaid'
  // One card at a time.
  if ((await read($, held)) !== null) return 'pass'

  const card: TabGuardHeld = {
    toolUseId,
    tool,
    summaries: summaries as string[],
    showDetails: false,
    mutations: scripts.flatMap((s) => mutationTexts(s) as string[]),
    values: scripts.flatMap((s) => variableTexts(s) as string[]),
    target: await targetOf($, server, input, scripts),
    where: 'pane',
  }
  let raised = false
  try {
    await update($, held, () => card)
    const placed = await $.ui.open({ id: PANE_ID, title: 'Tab guard', focus: true, rows: 12 + card.summaries.length })
    // A session the app is not showing has no surface: the pane stays open and is drawn when the
    // user opens the session, as the app's own prompt would be. Any other unplaced pane (a
    // narrow terminal, a surface with no panes) gives the card to the band. In a -p run no surface
    // ever comes, and the hold's limit refuses the call, as the settings hooks' ask would there.
    if (!placed.isPlaced && !placed.reason.startsWith('no-surface')) await update($, held, () => ({ ...card, where: 'band' as const }))
    // A system notification too, so the user hears of the card whatever session is on screen:
    // the person's own channel where there is one (a terminal), else the mod raises it itself (the
    // desktop app has no channel). A notification that cannot be sent leaves the card as it is.
    raised = await notify($, card)
    const startedAt = await $.clock.now()
    while (!decisions.has(toolUseId)) {
      if ((await $.clock.now()) - startedAt > HOLD_LIMIT_MS) return 'timeout'
      // Time inside a $ call does not count against the hook's 10 s; node is there, the
      // plugin's settings hooks run on it.
      await $.process.run(['node', '-e', 'setTimeout(() => {}, 250)'], { timeoutMs: 5000 })
    }
    return decisions.get(toolUseId)!
  } catch {
    return 'pass'
  } finally {
    decisions.delete(toolUseId)
    // Closed placed or not: an unplaced pane stays open until closed.
    await $.ui.close({ id: PANE_ID }).catch(() => undefined)
    await update($, held, () => null)
    // The card is answered: its notification would only point at nothing now.
    if (raised) await runNotifier($, { tag: toolUseId, remove: true })
  }
}

// Runs NOTIFIER (lib/tab-script.mjs) on node, which the plugin's settings hooks need anyway.
// Resolves whether it ran clean; never rejects.
async function runNotifier($: $, input: { title?: string; text?: string; tag: string; link?: string; remove?: boolean }): Promise<boolean> {
  try {
    const ran = await $.process.run(['node', '-e', NOTIFIER], { stdin: JSON.stringify(input), timeoutMs: 25000 })
    return ran.exitCode === 0
  } catch {
    return false
  }
}

// Whether the mod raised a notification of its own, so it can take it back once the card is
// answered. Why none was sent goes to the debug log, not the transcript.
async function notify($: $, card: TabGuardHeld): Promise<boolean> {
  const text = card.summaries.join('; ')
  let reason = 'failed'
  try {
    const sent = await $.ui.notify(text, { title: NOTIFY_TITLE })
    if (sent.isSent) return false
    reason = sent.reason
  } catch {
    // no channel answered
  }
  // The desktop app names the session it started in CLAUDE_CODE_HOST_SESSION_ID; its link opens
  // that session, so a click on the notification lands on the card.
  const host = (await $.env.get('CLAUDE_CODE_HOST_SESSION_ID')) ?? ''
  const link = /^local_[A-Za-z0-9-]{1,64}$/.test(host) ? `claude://code/continue?session=${host}` : undefined
  const raised = await runNotifier($, { title: NOTIFY_TITLE, text, tag: card.toolUseId, link })
  $.ui.log(`tab guard: no notification channel (${reason}); ${raised ? 'raised one itself' : 'could not raise one either'}`, { to: 'debug' })
  return raised
}

// The ticket that tells the settings hooks the user already said yes to this call. Node's
// os.tmpdir() reads the same variables. A failed write leaves no ticket, and the hooks ask.
async function leaveTicket($: $, tool: string, toolUseId: string, input: Record<string, unknown>) {
  try {
    const tmp = ((await $.env.get('TEMP')) ?? (await $.env.get('TMP')) ?? (await $.env.get('TMPDIR')) ?? '/tmp').replace(/[\\/]+$/, '')
    await $.fs.write(`${tmp}/${TICKET_FOLDER}/${toolUseId}`, ticketText(tool, scriptsOf(tool, input)))
  } catch {
    // the settings hook asks
  }
}

// Show details / Hide details, for the card that was drawn.
function toggle($: $, card: TabGuardHeld) {
  return () => update($, held, (h) => (h && h.toolUseId === card.toolUseId ? { ...h, showDetails: !h.showDetails } : h))
}

// ---- The hooks ---------------------------------------------------------------------------------

export const register: Register = (on) => {
  on('tool.call', { tool: SCRIPT_TOOL }, async ($, e, next) => {
    const [, server = ''] = SCRIPT_TOOL.exec(e.tool) ?? []
    const input = e as unknown as Record<string, unknown>
    const verdict = await judge($, e.tool, e.tool_use_id, server, input)
    if (verdict === 'cancel') {
      return { deny: 'The user pressed Cancel on the tab guard card, so this script was not run. Do not retry it or find another way to make this change unless the user asks.' }
    }
    if (verdict === 'unsaid') {
      return { deny: UNSAID }
    }
    if (verdict === 'timeout') {
      return { deny: 'The tab guard card got no answer within 10 minutes, so this script was not run. Ask the user before trying it again.' }
    }
    if (verdict === 'proceed') await leaveTicket($, e.tool, e.tool_use_id, input)
    return next(e)
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE_ID) return next(e)
    const card = await read($, held)
    if (card === null) return next(e)
    return drawCard($.ui.resolve(e), card, e.surface, toggle($, card))
  })

  // Where no pane is placed, the card takes the band above the prompt.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const card = await read($, held)
    if (card === null || card.where !== 'band') return next(e)
    return drawCard($.ui.resolve(e), card, e.surface, toggle($, card))
  })
}

// ---- Drawing the card --------------------------------------------------------------------------

// BlueStep One UI's default theme, One Sky (the design system's `:root`): the logo blue is
// `--primary`, and the type is IBM Plex Sans.
const PRIMARY = '#3180c3'
const PRIMARY_FOREGROUND = '#ffffff'
const FONT = 'IBM Plex Sans, Inter, system-ui, sans-serif'
const HEADER = `<svg xmlns="http://www.w3.org/2000/svg" width="520" height="40" viewBox="0 0 520 40">
<rect width="520" height="40" rx="8" fill="${PRIMARY}"/>
<text x="16" y="26" font-family="${FONT}" font-size="17" font-weight="600" fill="${PRIMARY_FOREGROUND}">BlueStep One</text>
<text x="504" y="25" text-anchor="end" font-family="${FONT}" font-size="13" fill="${PRIMARY_FOREGROUND}" fill-opacity="0.85">Tab guard · a change is waiting for you</text>
</svg>`

type Table = ReturnType<EngineInterface['ui']['resolve']>

function drawCard(t: Table, card: TabGuardHeld, surface: string, toggleDetails: () => unknown) {
  const { Box, Text, Button, Code } = t
  // The terminal draws no SVG: its header is a line of text in the same blue.
  const Svg = surface !== 'terminal' && 'Svg' in t ? t.Svg : undefined
  // The buttons answer the call this card was drawn for, never whichever one is held now.
  const decide = (choice: Decision) => () => {
    if (!decisions.has(card.toolUseId)) decisions.set(card.toolUseId, choice)
  }
  const host = card.target.origin ? new URL(card.target.origin).host : undefined
  return (
    <Box flexDirection="column" borderStyle="round" borderColor={PRIMARY} paddingX={1}>
      {Svg ? (
        // Its own size: left to the slot, a wide pane scaled the header up to a banner.
        <Svg source={HEADER} alt="BlueStep One · Tab guard" width={520} height={40} />
      ) : (
        <Text bold color={PRIMARY}>
          BlueStep One · Tab guard
        </Text>
      )}
      <Box marginTop={1}>
        <Text bold color={PRIMARY}>
          {ASK_TEXT}
        </Text>
      </Box>
      {card.summaries.length > 0 ? (
        <Box marginTop={1}>
          <Text dimColor>What Claude says it does</Text>
        </Box>
      ) : null}
      {card.summaries.map((summary, i) => (
        <Text key={`s${i}`} bold>
          {summary}
        </Text>
      ))}
      <Box marginTop={1}>
        {host ? (
          <Text>
            <Text dimColor>Site: </Text>
            <Text bold>{host}</Text>
          </Text>
        ) : (
          <Text color="warning">Couldn't tell which site this tab is on.</Text>
        )}
      </Box>
      {card.showDetails
        ? card.mutations.map((m, i) => (
            <Box key={`m${i}`} marginTop={1}>
              <Code source={m} language="graphql" />
            </Box>
          ))
        : null}
      {card.showDetails && card.values.length > 0 ? (
        <Box marginTop={1}>
          <Text dimColor>Values it sends</Text>
        </Box>
      ) : null}
      {card.showDetails
        ? card.values.map((v, i) => (
            <Box key={`v${i}`}>
              <Code source={v} language="js" />
            </Box>
          ))
        : null}
      <Box marginTop={1} gap={2}>
        {/* Proceed stands out, as the answer the user usually gives; nothing holds the focus,
            so a stray Enter answers neither. */}
        <Button key="proceed" label="Proceed" hotkey="1" variant="primary" onPress={decide('proceed')} />
        <Button key="cancel" label="Cancel" hotkey="2" onPress={decide('cancel')} />
        <Button key="details" label={card.showDetails ? 'Hide details' : 'Show details'} hotkey="3" plain onPress={toggleDetails} />
      </Box>
    </Box>
  )
}
