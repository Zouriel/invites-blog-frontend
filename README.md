# invites-blog-frontend

The web frontend for **invites.blog** — a premium animated digital-invitation platform. Inviters
create beautiful, role-aware, personalized invites **with no account**; invitees open a unique link
and RSVP with **zero login**.

This is a single Angular 22 workspace containing both web apps and a shared component library.

## Companion repos

- [`invites-blog-backend`](https://github.com/Zouriel/invites-blog-backend) — ASP.NET Core / .NET 10 API (also holds `TEMPLATE-GUIDE.md` for template authoring)
- [`invites-blog-deploy`](https://github.com/Zouriel/invites-blog-deploy) — Docker Compose + Caddy production topology

## Stack

- **Angular 22** — standalone components, **signals**, `OnPush` change detection, typed reactive
  forms, functional guards/interceptors
- **`@angular/cdk`** + **`@angular/aria`** for accessible primitives
- Built to **Docker** (nginx serving the SPA)

## Projects

```
projects/
  web-inviter/    # invites.blog     — landing, dynamic builder, dashboard
  web-invitee/    # me.invites.blog  — token invite view, inbox, RSVP
  ui/             # shared component library (published as multiple entry points)
```

The **`ui`** library ships as secondary entry points so apps import only what they use, e.g.
`ui/button`, `ui/form`, `ui/datepicker`, `ui/card`, `ui/dialog`, `ui/table`, `ui/theme`, and more.
It **must be built before the apps** (`ng build ui`).

- **web-inviter** hosts the **dynamic, manifest-driven builder**: it reads the chosen template's
  manifest and renders exactly the fields that template declares — one input per field, one
  image-upload slot per image. New template fields appear automatically with no code change.
- **web-invitee** renders the personalized invite by injecting the server's render payload into a
  **sandboxed `allow-scripts` iframe under a strict CSP**; guest content is bound as text.

## Quick start

Requires Node and npm, plus the backend API running (see `invites-blog-backend`).

```bash
npm install                              # first time
npx ng build ui                          # build the shared library first
npx ng serve web-inviter  --port 4200    # → http://localhost:4200
npx ng serve web-invitee  --port 4201    # → http://localhost:4201
```

## Build (Docker)

The included `Dockerfile` builds one app and serves it via nginx. Pass the app with `--build-arg`:

```bash
docker build --build-arg APP=web-inviter -t invites-blog-web-inviter .
docker build --build-arg APP=web-invitee -t invites-blog-web-invitee .
```

The build compiles the `ui` library first, then the selected app in production configuration, and
serves it with the SPA-friendly `nginx-spa.conf`.

## Tests

```bash
npx ng test          # Vitest
```
