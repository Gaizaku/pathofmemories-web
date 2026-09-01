# Path of Memories Web

The private community hub for the Path of Memories guild.

## Stack

- React + TypeScript + Vite
- Cloudflare Workers with static assets
- Supabase and Discord OAuth will be added in the authentication phase

## Local development

```bash
npm install
npm run dev
```

Run `npm run check` before opening a pull request. The first public-facing slice is intentionally authentication-free in local development; protected guild data must only be added after Discord membership verification is implemented.

## Deployment

Connect this repository in Cloudflare Dashboard → Workers & Pages → Create application → Import a repository. Use `main` as the production branch and `npm run build` as the build command.
