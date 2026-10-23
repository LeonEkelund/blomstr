# landing

The public marketing site at [blomstr.app](https://blomstr.app). Every
"Get started" and "Log in" hands off to the app at
[studio.blomstr.app](https://studio.blomstr.app).

## Develop

```sh
pnpm --filter @blomstr/landing dev   # http://localhost:5174
```

With no env file, the sign-in links point at the app's dev server
(`localhost:5173`), so running both apps locally hands off correctly.

## Deploy

A separate Netlify site from the app, built from the same repo:

| Setting | Value |
|---|---|
| Build command | `turbo run build --filter @blomstr/landing` |
| Publish directory | `apps/landing/dist` |
| `VITE_APP_URL` | `https://studio.blomstr.app` |

`VITE_APP_URL` is inlined at build time, so changing it needs a redeploy.

## Not done yet

Social crawlers (Discord, X, LinkedIn, Slack) don't run JavaScript, so a
shared link has no preview card. Prerendering with `vite-react-ssg` would fix
that.
