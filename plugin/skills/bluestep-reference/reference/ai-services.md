---
description: "B.ai is the platform's tenant-metered model access for BSJS — synchronous call/agent/tools surface, spend budgets keyed by flag, ai_denied handling, Relate-native form-filling tools, audio input, and AI write provenance via RowContext.ai(). Load when a component needs model access, AI generation, agents, or AI tools."
---

# `B.ai` — platform model access

**`B.ai` is the platform's model access**, reachable from any BSJS component. It runs server-side and
bills to the tenant, so a call needs only a prompt — provider, model, and credentials all come from the
tenant's own configuration.

## Availability and failure modes

Guard with `typeof B.ai !== "undefined"`: the surface is **experimental** and not present on every
pod/tenant. A production caller needs a fallback for **three** distinct outcomes — a **throw**, a
**denial** (`stopReason === "ai_denied"`, with `denialMessage` carrying the reason), and a
**successful-looking result with empty `text`**. Check the text, not just `stopReason`.

## Execution model — fully synchronous

`call()`, `sendMessage()`, and `sendAudio()` each return an `AiCallResult` **directly**. The BSJS
surface has no Promises and no token-streaming path, so write straight-line code.

## One-shot: `B.ai.call(options)`

The minimal call is three fields and no credential. Omitting `provider` / `model` / `apiKey` routes to
the **tenant default** and through the system's usage tracking:

```ts
const res = B.ai.call({
  flag: "my-component-purpose",
  systemPrompt: "You write a one-line summary. Output only the summary.",
  message: "…input text…",
});
if (res.stopReason === "ai_denied") { /* denialMessage explains why */ }
```

`AiCallOptions` extends `AiClientOptions`, so a one-shot call accepts everything a client does:

| Option | Notes |
| --- | --- |
| `message` | the user turn (`AiCallOptions` only) |
| `systemPrompt` | instruction preamble |
| `flag` | **budget / tracking bucket key** — see below; not a feature toggle |
| `provider`, `model` | omit for the tenant default |
| `apiKey` | override to bring your own credential; **the default path does not need one** |
| `tools` | array of `AiToolLiteral` — inline tools without building an agent |
| `chatHistory` | `AiChatHistoryEntry[]` (`role: "user" \| "assistant" \| "tool"`) |
| `onTurn` | `(AiCallResult) => AiTurnDecision \| null` — see the agent section |

`AiCallResult` carries `text`, `stopReason`, `inputTokens`, `outputTokens`, `iterations`, `exchanges`,
a `toolCalls` array (`{name, arguments, result, isError}`), and optional `denialCode` / `denialMessage`.

> Only `ai_denied` is a **confirmed** `stopReason` value, and no `denialCode` values are confirmed.
> Branch on `ai_denied`; treat any other value as opaque rather than assuming a vocabulary.

## Multi-turn: `B.ai.agent()`

`agent()` returns an `AiAgent` with fluent setters — `setProvider`, `setModel`, `setApiKey`, `setFlag`,
`setSystemPrompt`, `setChatHistory`, `setOnTurn`, `addTool`, `removeTool` — each returning the agent.
Drive it with `sendMessage(message)` or `sendMessage(message, executeTools)`, read back with
`getChatHistory()`, and run tool calls yourself via `applicator(toolCalls)` when you passed
`executeTools: false`.

`setOnTurn` is the loop control: the callback receives each `AiCallResult` and returns an
`AiTurnDecision` — `{ message }` to inject another turn, `{ done: true }` to stop — or `null` to let
the default flow continue.

**Choosing between them:** `call()` for a single transformation with a known input and output.
`agent()` when the model needs tools, several turns, or conversation state.

## Typed tools: `B.ai.tool`

`B.ai.tool` is an `AiToolFactory`. `custom()` returns an `AiToolBuilder`, and the schema you set types
the executor's argument through `FromSchema<S>` — so the executor is checked, not `any`:

```ts
const tool = B.ai.tool.custom()
  .setName("lookup_status")
  .setDescription("Look up the current status for a case number.")
  .setSchema({ type: "object", properties: { caseNo: { type: "string" } }, required: ["caseNo"] })
  .setExecutor((args) => statusFor(args.caseNo)); // args.caseNo is typed
```

The Relate-native helpers are the reason to reach for this surface at all — they build a tool that
lets the model **fill a form entry** without hand-writing a schema:

- `forNewEntry(form, options?)` — a tool that creates an entry on a `MultiFormRecord`.
- `forExistingEntry(entry, options?)` — a tool that updates an existing `FormEntry`.

Both take `include` / `exclude` / `required` field lists, a `name` / `description` override, and an
`afterApply(entry, args)` hook for validation or follow-on writes. `getInputSchema(tool)` returns the
generated schema when you need to inspect it.

## Budgets, metering, and denial

`flag` is the **named bucket** spend and usage are recorded against — pass the *same* string to
`configure()` and to every `call()` for that purpose, or budgeting and reporting will not line up.
Pick one stable flag per component/purpose.

```ts
B.ai.configure({
  flag: "my-component-purpose",
  maxSpendMicros: 1000000, // micros of USD — 1,000,000 = $1.00
  maxIterations: 2,
  budgetSchedule: "MONTHLY",
});
```

`maxSpendMicros` and `maxIterations` are both **required** on `AiConfigureOptions`; `unitId`, `enable`,
`budgetSchedule`, and `utcOffsetMinutes` are optional. `maxSpendMicros` is **micros of USD**:
1,000,000 = $1.00. `budgetSchedule` is `HOURLY | DAILY | WEEKLY | MONTHLY | LIFETIME`.

**`configure()` is best-effort and can throw** — wrap it separately and carry on. A failed budget
upsert is not fatal; the tenant-wide gate still applies. Treat the per-flag budget as an optimization,
never as the only thing bounding spend.

`usageReporting(options?)` returns an `AiUsageReport`: `spendMicrosUsed`, `maxSpendMicros`,
`maxIterations`, `budgetSchedule`, `windowStart` / `windowEnd`, and **`configured`** — the flag to read
when you need to know whether the tenant has a budget set up at all.

## Audio in: `B.ai.streamingAgent()`

`streamingAgent()` returns a `StreamingAiAgent` for **audio input**. It carries the same fluent setters
plus `sendAudio(audio)` and `sendAudio(audio, documentField)`, taking a Java `InputStream` or
`ByteArray` and returning an ordinary `AiCallResult`; the two-argument form writes to a
`DocumentLinkField`. The name refers to the audio stream — output is returned whole, as everywhere else.

## AI provenance in formulas: `RowContext.ai()`

Separate concern, and the one place AI shows up in code that never calls a model. In a save/row
context, `RowContext.ai()` returns `AiContext | null` — **`null` means a human wrote the row**. When
non-null it answers *which* AI action wrote it, via `proxyType()`, `toolName()`, `aiModel()`,
`agentType()`, `conversationId()`, `turnNumber()`, `clientIp()`, and `userAgent()`. Use it in a
post-save formula to treat model-driven writes differently from human ones — for example to skip a
notification, or to tag a record for review.

## Known gaps

No first-class web search or citations, and no image generation on this surface as of the observed
date. If a feature needs one of those, it is not a `B.ai` call today — raise it rather than
improvising.

Related: [endpoint output channel](endpoint-output-channel.md), [internal loopback fetch](internal-loopback-fetch.md),
[http requester](http-requester.md) — `httpRequester` is for genuinely third-party services, **not** for
reaching a model.
