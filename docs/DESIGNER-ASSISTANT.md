# Designer assistant

A chat assistant inside the web template designer that uses the designer's own tools to create and
change a template for the person, the way Canva's assistant does. It replaces the plan in
`reports/Agentic design for the designer.md` (2026-10-29), which the owner turned down on 2026-11-07.

## What the owner decided (2026-11-07)

- The assistant drives the designer's existing tools: add and change text, shapes, pictures, photo
  slots and buttons; colours, fonts and the theme; position and size; ways in and out, loops, effect
  moves, stickers, art from the library; page length and stage mode. It builds a template from
  scratch or changes the one that is open.
- It applies changes straight away. One message from the person = one undo step, with Undo offered.
- Web designer only (the Flutter apps have no designer).
- Phone: a chat sidebar that slides in and out. Desktop: an "Assistant" tab in the side panel.
- Chats are saved with each design.
- Premium and Venue accounts only (admins too, for support). Everyone else sees the button with a
  Premium prompt. The server checks on every request.
- Photos: the person uploads with the designer's normal upload tool; the assistant can then place and
  style those photos. No attachments in the chat.
- Model: Claude Sonnet 5.5 (`claude-sonnet-5-5`). Allowance: about USD 5 of usage per person per
  calendar month (UTC), then "You've used this month's AI allowance" with the reset date.
- Keep token use low.

## How it works

```
browser (DesignStore)                 API (.NET)                         Claude
 person types ───────────────────────> POST /api/designs/{id}/assistant
                                        checks Premium + allowance
                                        saves the message
                                        system + tools (cached) +
                                        recent history + outline ───────> Messages API
                                        <─────────────────────────────── text + tool calls
 <──────────────── reply text + tool calls (saved)
 runs each tool on the live store
 (inside one undo transaction)
 POST .../assistant/results ─────────> saves results, calls Claude again ...
 ... until Claude stops; the transaction closes: one undo step, "Undo" offered
```

- **Tools run in the browser**, on the same `DesignStore` methods the panels use, so every rule the
  editor keeps (keyframe tags, stage bars, retiming, limits) holds, and the canvas updates as each
  call lands. The server never edits the scene; the edits reach it through normal autosave, so
  `DesignScene.Parse`, the validator and Check still guard everything, and publishing stays a human
  click.
- **The API key stays on the server.** The loop is a hand-written Messages API loop with the
  `Anthropic` NuGet SDK. Each step is one short HTTP request; the conversation lives in the database,
  so a dropped connection loses nothing.
- **No raw HTML, CSS or asset data** can come from the model: tools take names, ids, numbers and
  colours, validated in the browser before anything is applied. Event text, art titles and file
  names are passed as data, never as instructions.

## Keeping token use low

| Lever | What it does |
|---|---|
| Outline, not scene | Each message carries a one-line-per-element outline (id, type, name, box, text start, motion) with asset data stripped. A large design is about 2-7 KB instead of 600 KB. Full element JSON only when the model asks (`get_elements`). |
| Cached prefix | Tool definitions + a fixed system prompt (schema guide, catalog of fonts, presets, loops, moves, stickers) never change between requests, so they are read from the prompt cache at a tenth of the price. |
| Recipe tools | One call applies a preset, an effect move, a loop or a sticker, instead of the model writing keyframes. Output tokens are the expensive ones. |
| Short history | The database keeps the whole chat for the person; the model sees only the last few exchanges, with old tool results shortened. |
| Low effort | `effort: low` for routine edits. |
| Small replies | Tool results are one line ("added text e12"). `max_tokens` 4096 per step, at most 16 steps per message. |
| Hard limits | Per-person monthly allowance from real `usage` numbers; per-person request rate limit; a workspace spend limit in the Anthropic Console as a backstop. |

## Data

- `DesignAssistantMessage`: design id, user id, sequence, role (user / assistant / tool results),
  content JSON (text, tool calls, tool results; thinking blocks with their signatures kept exactly),
  created at.
- `AssistantUsage`: user id, month (yyyy-MM), input / cache-write / cache-read / output tokens, cost
  in micro-dollars. Updated from every response's `usage`.

## API

- `GET /api/designs/{id}/assistant` - the chat, plus status: allowed, why not (not Premium /
  allowance used), allowance used and when it resets.
- `POST /api/designs/{id}/assistant/messages` `{ text, outline, selection }` - starts a turn.
- `POST /api/designs/{id}/assistant/results` `{ results: [{ id, ok, text }], outline }` - continues
  it. Both answer `{ messages, toolCalls, done, usage }`.
- `DELETE /api/designs/{id}/assistant` - starts a new chat.

Owner-only (the design's owner); `designs.manage`; Premium / Venue / admin; rate limited per user.

## Web

- `DesignStore.transaction(label, run)`: commits inside fold into one undo step.
- `assistant/` folder: tool definitions' browser side (validation + calls into the store), the
  outline builder, the chat state, and the chat panel.
- Desktop: an "Assistant" tab in the side panel. Phone: a top-bar button opens a right-side
  `ui-drawer` sidebar; it closes to show the canvas.
- UI library: `ui-chat-bubble` already exists in both libraries. Anything missing (a message
  composer) is added to both libraries first.

## Not in this version

Rendered screenshots for the model to critique, generating several variations, and background jobs.
They can follow if real use shows the need.
