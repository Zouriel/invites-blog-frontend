# invites-blog-frontend

The Angular workspace for **invites.blog** — animated digital invitations, and what happens around
them.

Two applications, one shared design system:

| Project | Host | What it is |
| --- | --- | --- |
| `web-inviter` | `invites.blog` | The studio. Templates, the build wizard, the dashboard, media buckets, and the admin and designer tools. |
| `web-invitee` | `me.invites.blog` | The guest's side: signing in with a code, and the invitations sent to you. |

UI comes from **`@zouriel/ui`**, a published package from GitHub Packages
([`Zouriel/angular-ui-library`](https://github.com/Zouriel/angular-ui-library)) — not a folder in
this repo. Build UI from its components; if one is missing a variant, fix it there and publish,
rather than hand-rolling a one-off here.

Angular 22 throughout: standalone components, signals, `OnPush`, typed reactive forms, and lazy
routes.

## What it does

**Building an invitation.** A wizard walking content → theme → roles → guests → venue → RSVP
questions → delivery, with a live preview of the real template beside the fields. The preview is
sized to the viewport rather than the column, so the thing you are editing is always fully on screen.

**Events.** Where a signed-in person lands. Everything sent to them, everything they are hosting,
their media buckets, and anything that was cancelled. Received leads and is the default: everyone
with an account has been invited to something, while only some of them are running an event.

**Media buckets.** A bucket has a name, a cover, a size and a date. It may belong to an event or
stand alone — a trip or a reunion has no invitation behind it — and either way it is an occasion, so
it is listed **among** the events rather than in a tab of its own, tagged "Media only" when nothing
was ever sent for it. Sizes are 10/20/30/50 GB on a six-month term, priced by the API so the app
never hardcodes a number. A bucket only accepts uploads on its night, and every control that adds is
hidden outside that window rather than disabled.

**Contribution codes.** A bucket's owner generates a QR code and prints it. `/q/:token` is where a
scan lands: one column, one question, then a picker. On an anonymous code the question is just a name.
On a verified one it is an email or phone, which has to be on the event's guest list, and the credit
comes from that list rather than the page. It is deliberately the only unguarded route in the app, and it
can only ever add — a contributor never sees the bucket. Photos and video both; a clip's poster frame
is drawn in the browser before upload, because the API has no video decoder.

**Everything else.** The template gallery and detail pages, bespoke-design inquiries, the designer's
submission tools, and the admin review queues.

## Running it

```bash
npm ci                       # needs NODE_AUTH_TOKEN for the @zouriel scope — see .npmrc
npx ng serve web-inviter     # http://localhost:4200
npx ng serve web-invitee     # http://localhost:4201
```

Both expect the API on `http://localhost:8080` (`projects/*/src/environments/environment.ts`).

```bash
npx ng build web-inviter     # dist/web-inviter
npx ng test                  # vitest
```

## Things worth knowing before changing something

- **`index.html` must stay `no-cache`** (`nginx-spa.conf`). Hashed JS/CSS keep a one-year immutable
  cache, but a cached HTML shell points at chunks that 404 after a redeploy, and lazy routes then
  silently fail to navigate while direct URL loads still work.
- **The session interceptor is an allowlist.** `ACCOUNT_SCOPED` in
  `shared/interceptors/session.interceptor.ts` decides which calls carry the token. A new
  account-scoped API prefix that is not on that list goes out anonymous and comes back 403 —
  including, once, every media-bucket call. The contributor routes under `/api/q/` must stay OFF it.
- **Required inputs are not readable in a constructor.** Route-bound inputs have no value until
  after construction; read them in `ngOnInit` or the first request goes out with an empty id.
- **Campaigns pin their template package**, so a template change reaches new campaigns only.
