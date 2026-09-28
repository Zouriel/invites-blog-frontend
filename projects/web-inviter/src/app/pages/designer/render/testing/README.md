# Renderer parity

The editor previews with `../` — a TypeScript port of the server's `DesignCompiler`, `SvgSanitizer`,
`DesignSampleData` and `ServerBinder`. The server still compiles everything that is published. These
files keep the two identical.

- `parity-fixtures.json.gz` — what the C# made of the starters, a rebuilt Gilded Hour and 40 random
  scenes. `../parity.spec.ts` compares every published page byte for byte and every bound preview as
  a parsed document. It runs with the rest of the unit tests.
- `make-corpus.mjs` — seeded random scenes that reach every element type, option and awkward value.
- `generate-scripts.py` — copies the page scripts out of the C# into `../scripts.ts`.

## After changing the compiler (either side)

```sh
# 1. scenes
node make-corpus.mjs 300 11 > /tmp/scenes.json
# 2. what the server makes of them (backend repo)
DESIGN_PARITY_SCENES=/tmp/scenes.json DESIGN_PARITY_OUT=/tmp/out.json \
  dotnet test InvitesBlog.Tests --filter FullyQualifiedName~DesignParityExportTests
# 3. compare (frontend repo)
DESIGN_PARITY_OUT=/tmp/out.json npx ng test web-inviter --watch=false --include='**/render/parity.spec.ts'
```

Run a few seeds of ~300 (one export per run: the test worker holds every document in memory). To
refresh the committed fixtures, export the starter-plus-40 corpus the same way and `gzip -9` it here.

## Keyframe audit

Parity says the two compilers agree; the audit says the page does what the editor shows. At every
keyframe's place in the scroll, halfway between keyframes, at a stage bar's ends and at the bottom of
the page — down the page and back up — the page must show the opacity, position and blur the editor's
model (`stateAt`, `visibleAt`, `pinOffsetAt`, `effectAt`) says, and split text must have every piece
exactly at the keyframe's state. Scenes are built the way the editor builds them: every way in and way
out, in-and-out pairs with their bars trimmed, every effect move, keyframes placed by hand, split
words and letters.

```sh
# pages + expectations (frontend repo)
KEYFRAME_AUDIT_OUT=/tmp/audit.json npx ng test web-inviter --watch=false --include='**/designer/keyframe-audit.spec.ts'
# in Chromium, with scroll-driven CSS and as an old browser
PLAYWRIGHT_FROM=<dir with playwright-core> node keyframe-audit.mjs /tmp/audit.json both
```

It should report 0 problems. Run it after any change to the compiler, the old-browser script, or how
the editor places keyframes.
