import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { NOTIFY_TITLE, UNSAID, tabsFromResult } from '../hooks/register.tsx'
import { NOTIFIER, TICKET_FOLDER, scriptsOf, ticketText } from '../hooks/lib/tab-script.mjs'

// Nothing sits beneath the mod in a test: each hook here stands for the engine, the browser pane,
// the project's .claude/bluestep-one.json and the settings hook hooks/tab-guard.mjs (its ticket check
// has its own tests in hooks/test/tab-guard.test.mjs).

const CWD = '/work/project'
const CONFIG = { components: [{ id: '900___1', name: 'task-board' }] }
const JS = 'mcp__Claude_Browser__javascript_tool'
const ASK = 'This script would change data in BlueStep. Allow it only if you want Claude to make this change.'
const SAID = '// Saves a test row on the test record\n'
const BARE_SAVE = 'await fetch("/gql", { method: "POST", body: JSON.stringify({ query: "mutation { saveRow(input: { name: \\"ZZ Test\\" }) { id } }" }) })'
const SAVE = SAID + BARE_SAVE
const SAVE_VARS =
  SAID +
  'const variables = { id: "900___2", v: 21 }; await fetch("/gql", { method: "POST", body: JSON.stringify({ query: "mutation Save($id: String!, $v: Int) { saveRow(id: $id, expectedVersion: $v) { id } }", variables }) })'
const BUILD = 'await fetch("/gql", { method: "POST", body: JSON.stringify({ query: "mutation { buildCustomComponent(id: \\"900___1\\") { sha } }" }) })'
const PUBLISH = BUILD.replace('buildCustomComponent', 'publishCustomComponent')
const tabContext = (id: string, url: string) =>
  `ok\n\nTab Context:\n- Executed on tabId: ${id}\n- Available tabs:\n  • tabId ${id}: "Page" ("${url}")`

// The kit hands paths over in the platform's form (C:\work\project on Windows).
const unixPath = (path: string) => path.replace(/\\/g, '/').replace(/^[A-Za-z]:/, '')

type World = {
  opened: string[]
  closed: string[]
  notified: { text: string; title?: string }[]
  notifier: { title?: string; text?: string; tag: string; link?: string; remove?: boolean }[]
  ran: string[]
  asks: string[]
  // The files the mod wrote: its tickets.
  written: Map<string, string>
  paneOpen: Promise<void>
}

// The world one test runs in. `tabs` is what the browser's tab list answers; undefined makes that
// read fail, as when the pane is closed. `noPane` places no pane, so the card takes the band;
// `noSurface` is a session the app is not showing: the pane waits to be drawn. `noNotify` sends
// no system notification.
function world(
  on: On,
  options: { tabs?: { tabId: string; origin: string; isActive?: boolean }[]; noProject?: true; noPane?: true; noSurface?: true; noNotify?: true } = {},
): World {
  const w: World = { opened: [], closed: [], notified: [], notifier: [], ran: [], asks: [], written: new Map(), paneOpen: Promise.resolve() }
  let markOpen = () => {}
  w.paneOpen = new Promise((resolve) => (markOpen = resolve))
  mock.env(on, { HOME: '/home/someone', TEMP: '/tmp/someone', CLAUDE_CODE_HOST_SESSION_ID: 'local_test-1' })
  on('fs.write', (_, e) => {
    w.written.set(unixPath(e.path), e.text)
    return { value: undefined }
  })
  mock.clock(on)
  on('session.cwd', () => ({ value: CWD }))
  on('session.surfaces', () => ({ value: options.noSurface ? [] : (['desktop'] as const) }))
  on('fs.exists', (_, e) => ({ value: !options.noProject && unixPath(e.path) === `${CWD}/.claude/bluestep-one.json` }))
  on('fs.read', () => ({ value: JSON.stringify(CONFIG) }))
  // The hold's sleep: a real pause, so the poll lets the press through.
  // The notifier the mod runs where no channel sends: `notifier` records what it was handed.
  on('process.run', async (_, e) => {
    if (e.argv[2] === NOTIFIER) {
      w.notifier.push(JSON.parse(e.init?.stdin ?? '{}'))
      return { value: { exitCode: 0, stdout: '', stderr: '' } }
    }
    await new Promise((resolve) => setTimeout(resolve, 5))
    return { value: { exitCode: 0, stdout: '', stderr: '' } }
  })
  on('mcp.call', () =>
    options.tabs
      ? { value: { isError: false, content: [{ type: 'text', text: JSON.stringify({ browserOpen: true, tabs: options.tabs }) }] } }
      : { value: { isError: true, content: [] } },
  )
  on('ui.open', (_, e) => {
    w.opened.push(e.id)
    markOpen()
    if (options.noSurface) return { value: { isPlaced: false, reason: 'no-surface: none is attached' } }
    return { value: options.noPane ? { isPlaced: false, reason: 'the attached surfaces place no panes' } : { isPlaced: true } }
  })
  on('ui.notify', (_, e) => {
    w.notified.push({ text: e.text, title: e.title })
    return { value: options.noNotify ? { isSent: false, reason: 'no-channel' } : { isSent: true, channel: 'auto' } }
  })
  on('ui.close', (_, e) => {
    w.closed.push(e.id)
    return { value: undefined }
  })
  // The app's own band, drawn when the mod has no card there.
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>app</Text>
  })
  // The settings hooks: tab-guard.mjs asks on any mutation that is not a lone own build, and
  // bluestep-tools' tab-guard.sh on every mutation, unless the mod left a ticket for this exact
  // call. In a test nobody answers that ask, so the call ends there; `asks` records that it was put.
  on('classic.PreToolUse', (_, e) => {
    if (!/mutation/.test(JSON.stringify(e))) return {}
    const ticket = `/tmp/someone/${TICKET_FOLDER}/${e.tool_use_id}`
    // The kit hands this hook the call as tool.call has it ({ tool, text, ... }), not the
    // tool_name / tool_input a settings hook reads on stdin; take either.
    const c = e as unknown as { tool_name?: string; tool_input?: unknown; tool?: string }
    const name = c.tool_name ?? c.tool ?? ''
    if (w.written.get(ticket) === ticketText(name, scriptsOf(name, c.tool_input ?? c))) return {}
    w.asks.push(ASK)
    return { ask: ASK }
  })
  on('tool.call', (_, e) => {
    w.ran.push(e.tool)
    return { result: {}, text: 'done' }
  })
  return w
}

const PANE = {
  plugin: 'bluestep-one',
  component: 'Pane',
  requestId: 'tab-guard',
  props: {
    title: 'Tab guard',
    isFocused: true,
    bodyColumns: 80,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

const BAND = {
  plugin: 'bluestep-one',
  component: 'AbovePrompt',
  requestId: 'above-prompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 6, bodyColumns: 100, scroll: { offset: 0, bodyRows: 6 }, view: {} },
} as const

test('reads the tabs out of a tab list and a Tab Context block', () => {
  const list = tabsFromResult(JSON.stringify({ browserOpen: true, tabs: [{ tabId: 'a', origin: 'https://one.example.test', isActive: true }] }))
  expect(list.active).toBe('a')
  expect(list.urls).toEqual({ a: 'https://one.example.test' })
  expect(tabsFromResult(tabContext('seed', 'https://source.example.test/x?y=1')).urls).toEqual({ seed: 'https://source.example.test/x?y=1' })
})

test('a script with no mutation goes on with no card', async ($, on) => {
  const w = world(on, { tabs: [{ tabId: 'seed', origin: 'https://one.example.test', isActive: true }] })
  const ran = await $.tool.call({ tool: JS, text: 'await fetch("/gql", { method: "POST", body: "{ user { id } }" })' } as never)
  expect(ran.deny).toBeUndefined()
  expect(w.opened).toEqual([])
  expect(w.ran).toEqual([JS])
})

test('a build of an own component gets a card in plain words with no comment needed; Proceed leaves a ticket', async ($, on) => {
  const w = world(on, { tabs: [{ tabId: 'seed', origin: 'https://one.example.test', isActive: true }] })
  const call = $.tool.call({ tool: JS, text: BUILD } as never)
  await w.paneOpen
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /^Builds the task-board component from its draft$/ })).toBeDefined()
  await ui.press({ key: 'proceed' })
  const ran = await call
  await ui.unmount()
  expect(ran.deny).toBeUndefined()
  expect(w.written.size).toBe(1)
  expect(w.asks).toEqual([])
  expect(w.ran).toEqual([JS])
})

test('a publish is worded as one, and a comment the script opens with wins', async ($, on) => {
  const w = world(on, { tabs: [{ tabId: 'seed', origin: 'https://one.example.test', isActive: true }] })
  let call = $.tool.call({ tool: JS, text: PUBLISH } as never)
  await w.paneOpen
  let ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /^Publishes the task-board component, so its last build goes live$/ })).toBeDefined()
  await ui.press({ key: 'cancel' })
  expect((await call).deny).toMatch(/pressed Cancel/)
  await ui.unmount()
  call = $.tool.call({ tool: JS, text: `// Publishes the new dialog wording\n${PUBLISH}` } as never)
  for (let i = 0; i < 50 && w.opened.length < 2; i++) await new Promise((resolve) => setTimeout(resolve, 5))
  ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /^Publishes the new dialog wording$/ })).toBeDefined()
  await ui.press({ key: 'cancel' })
  await call
  await ui.unmount()
})

test('in a session the app is not showing, the card waits in its pane instead of falling back to the app prompt', async ($, on) => {
  const w = world(on, { tabs: [{ tabId: 'seed', origin: 'https://source.example.test', isActive: true }], noSurface: true })
  const call = $.tool.call({ tool: JS, text: SAVE } as never)
  await w.paneOpen
  // Not on the band: the pane is drawn once the app shows the session.
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await band.find({ type: 'Text', text: /^Site: / })).toBeUndefined()
  await band.unmount()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /^Saves a test row on the test record$/ })).toBeDefined()
  await ui.press({ key: 'proceed' })
  const ran = await call
  await ui.unmount()
  expect(ran.deny).toBeUndefined()
  expect(w.asks).toEqual([])
  expect(w.closed).toEqual(['tab-guard'])
  // A system notification says a change is waiting, whatever session is on screen.
  expect(w.notified).toEqual([{ text: 'Saves a test row on the test record', title: NOTIFY_TITLE }])
  // The channel sent it, so the mod raises none of its own.
  expect(w.notifier).toEqual([])
})

test('where no channel sends a notification, the mod raises one itself and takes it back once answered', async ($, on) => {
  const w = world(on, { tabs: [{ tabId: 'seed', origin: 'https://source.example.test', isActive: true }], noNotify: true })
  const call = $.tool.call({ tool: JS, text: SAVE } as never)
  await w.paneOpen
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'proceed' })
  const ran = await call
  await ui.unmount()
  expect(ran.deny).toBeUndefined()
  expect(w.asks).toEqual([])
  expect(w.notifier).toHaveLength(2)
  // A click on it opens the session holding the card.
  expect(w.notifier[0]).toEqual({
    title: NOTIFY_TITLE,
    text: 'Saves a test row on the test record',
    tag: w.notifier[1]!.tag,
    link: 'claude://code/continue?session=local_test-1',
  })
  expect(w.notifier[1]!.remove).toBe(true)
})

test('another mutation is held; the card names the site and values; Proceed leaves a ticket, so the settings hook does not ask again', async ($, on) => {
  const w = world(on, { tabs: [{ tabId: 'seed', origin: 'https://source.example.test', isActive: true }] })
  const call = $.tool.call({ tool: JS, text: SAVE_VARS } as never)
  await w.paneOpen
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Svg' })).toBeDefined()
  await ui.press({ key: 'details' })
  expect((await ui.findAll({ type: 'Code' })).map((c) => c.text)).toEqual([
    'mutation Save($id: String!, $v: Int) { saveRow(id: $id, expectedVersion: $v) { id } }',
    '{ id: "900___2", v: 21 }',
  ])
  expect(await ui.find({ type: 'Text', text: /Values it sends/ })).toBeDefined()
  expect((await ui.find({ type: 'Text', text: /source\.example\.test/ }))?.text).toBe('Site: source.example.test')
  expect(await ui.find({ type: 'Text', text: /Couldn't tell/ })).toBeUndefined()
  await ui.press({ key: 'proceed' })
  const ran = await call
  await ui.unmount()
  expect(ran.deny).toBeUndefined()
  expect([...w.written.keys()]).toEqual([expect.stringMatching(new RegExp(`^/tmp/someone/${TICKET_FOLDER}/`))])
  expect(w.asks).toEqual([])
  expect(w.ran).toEqual([JS])
})

test('a script that says what it saves shows that first, with the code folded until asked', async ($, on) => {
  const w = world(on, { tabs: [{ tabId: 'seed', origin: 'https://source.example.test', isActive: true }] })
  const call = $.tool.call({ tool: JS, text: `// Saves Item A's quantity as 12 on the test record\n${SAVE_VARS}` } as never)
  await w.paneOpen
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: /^What Claude says it does$/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^Saves Item A's quantity as 12 on the test record$/ })).toBeDefined()
    expect(await ui.findAll({ type: 'Code' })).toHaveLength(0)
    await ui.press({ key: 'details' })
    expect(await ui.findAll({ type: 'Code' })).toHaveLength(2)
    await ui.press({ key: 'details' })
    expect(await ui.findAll({ type: 'Code' })).toHaveLength(0)
    await ui.unmount()
  }
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'cancel' })
  await call
  await ui.unmount()
})

test('Cancel refuses the call and nothing runs', async ($, on) => {
  const w = world(on, { tabs: [{ tabId: 'seed', origin: 'https://template.example.test', isActive: true }] })
  const call = $.tool.call({ tool: JS, text: SAVE } as never)
  await w.paneOpen
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /template\.example\.test/ }))?.text).toBe('Site: template.example.test')
  expect(await ui.find({ type: 'Text', text: /^BlueStep One · Tab guard$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Values it sends/ })).toBeUndefined()
  await ui.press({ key: 'cancel' })
  const ran = await call
  await ui.unmount()
  expect(ran.deny).toMatch(/pressed Cancel/)
  expect(w.ran).toEqual([])
  expect(w.written.size).toBe(0)
})

test('when the tab list cannot be read, the card says it could not tell the site', async ($, on) => {
  const w = world(on)
  const call = $.tool.call({ tool: JS, text: SAVE } as never)
  await w.paneOpen
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /^Couldn't tell which site this tab is on\.$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^Site: / })).toBeUndefined()
  await ui.press({ key: 'cancel' })
  await call
  await ui.unmount()
})

test('a script that fetches another site outright names that site', async ($, on) => {
  const w = world(on, { tabs: [{ tabId: 'seed', origin: 'https://source.example.test', isActive: true }] })
  const call = $.tool.call({ tool: JS, text: SAVE.replace('"/gql"', '"https://other.example.test/gql"') } as never)
  await w.paneOpen
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /^Site: / }))?.text).toBe('Site: other.example.test')
  await ui.press({ key: 'cancel' })
  await call
  await ui.unmount()
})

test('where no pane is placed, the card takes the band above the prompt', async ($, on) => {
  const w = world(on, { tabs: [{ tabId: 'seed', origin: 'https://source.example.test', isActive: true }], noPane: true })
  const call = $.tool.call({ tool: JS, text: SAVE } as never)
  await w.paneOpen
  // The band is drawn once the card has moved there.
  let ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  for (let i = 0; i < 50 && !(await ui.find({ type: 'Text', text: /^Site: / })); i++) {
    await ui.unmount()
    await new Promise((resolve) => setTimeout(resolve, 5))
    ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  }
  expect((await ui.find({ type: 'Text', text: /^Site: / }))?.text).toBe('Site: source.example.test')
  await ui.press({ key: 'cancel' })
  const ran = await call
  await ui.unmount()
  expect(ran.deny).toMatch(/pressed Cancel/)
})

test('outside a project the mod shows no card, and the settings hook asks as before', async ($, on) => {
  const w = world(on, { tabs: [{ tabId: 'seed', origin: 'https://source.example.test', isActive: true }], noProject: true })
  await $.tool.call({ tool: JS, text: SAVE } as never)
  expect(w.opened).toEqual([])
  expect(w.written.size).toBe(0)
  expect(w.asks).toEqual([ASK])
})

test('a changing script with no opening comment goes back to Claude, with no card and no ticket', async ($, on) => {
  const w = world(on, { tabs: [{ tabId: 'seed', origin: 'https://source.example.test', isActive: true }] })
  const ran = await $.tool.call({ tool: JS, text: BARE_SAVE } as never)
  expect(ran.deny).toBe(UNSAID)
  expect(w.opened).toEqual([])
  expect(w.written.size).toBe(0)
  expect(w.ran).toEqual([])
  // A batch is sent back when any of its changing scripts is unsaid.
  const batch = {
    tool: 'mcp__Claude_Browser__browser_batch',
    actions: [
      { name: 'javascript_tool', input: { text: SAVE } },
      { name: 'javascript_tool', input: { text: BARE_SAVE } },
    ],
  }
  expect((await $.tool.call(batch as never)).deny).toBe(UNSAID)
  // A comment after code is no opening comment.
  expect((await $.tool.call({ tool: JS, text: `${BARE_SAVE}\n// Saves a test row` } as never)).deny).toBe(UNSAID)
  expect(w.opened).toEqual([])
})
